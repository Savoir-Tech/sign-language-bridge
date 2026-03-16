"""
Train ST-GCN on the ASL Citizen dataset.

Usage:
    python train.py
    python train.py --epochs 100 --batch-size 32 --lr 5e-4 --device cuda:0
"""

import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import LambdaLR
from tqdm import tqdm

from architecture import STGCN, FC, Network
from config import (
    BATCH_SIZE,
    DROPOUT_RATIO,
    GRAPH_ARGS,
    GRAD_CLIP_NORM,
    IN_CHANNELS,
    LABEL_SMOOTHING,
    LEARNING_RATE,
    MAX_EPOCHS,
    MAX_FRAMES,
    N_OUT_FEATURES,
    NUM_WORKERS,
    WARMUP_EPOCHS,
    WEIGHT_DECAY,
)
from dataset import ASLCitizenDataset
from pose_transforms import Compose, RotationTransform, ShearTransform

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
POSE_DIR = DATA_DIR / "processed" / "pose_files"
CSV_DIR = DATA_DIR / "data_csv"


def seed_everything(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def seed_worker(_worker_id):
    worker_seed = torch.initial_seed() % 2**32
    np.random.seed(worker_seed)
    random.seed(worker_seed)


def get_warmup_cosine_scheduler(optimizer, warmup_epochs, total_epochs,
                                steps_per_epoch):
    """Linear warmup for *warmup_epochs*, then cosine decay to 0."""
    warmup_steps = warmup_epochs * steps_per_epoch
    total_steps = total_epochs * steps_per_epoch

    def lr_lambda(step):
        if step < warmup_steps:
            return step / max(warmup_steps, 1)
        progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
        return max(0.0, 0.5 * (1.0 + np.cos(np.pi * progress)))

    return LambdaLR(optimizer, lr_lambda)


def compute_grad_norm(model):
    total_norm = 0.0
    for p in model.parameters():
        if p.grad is not None:
            total_norm += p.grad.data.norm(2).item() ** 2
    return total_norm ** 0.5


def parse_args():
    p = argparse.ArgumentParser(description="Train ST-GCN for ASL recognition")
    p.add_argument("--epochs", type=int, default=MAX_EPOCHS)
    p.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    p.add_argument("--lr", type=float, default=LEARNING_RATE)
    p.add_argument("--max-frames", type=int, default=MAX_FRAMES)
    p.add_argument("--n-features", type=int, default=N_OUT_FEATURES)
    p.add_argument("--dropout", type=float, default=DROPOUT_RATIO)
    p.add_argument("--num-workers", type=int, default=NUM_WORKERS)
    p.add_argument("--warmup-epochs", type=int, default=WARMUP_EPOCHS)
    p.add_argument("--weight-decay", type=float, default=WEIGHT_DECAY)
    p.add_argument("--label-smoothing", type=float, default=LABEL_SMOOTHING)
    p.add_argument("--grad-clip", type=float, default=GRAD_CLIP_NORM)
    p.add_argument("--device", type=str, default=None,
                   help="Device to train on (auto-detected if omitted)")
    p.add_argument("--save-dir", type=str, default=str(BASE_DIR / "trained_models"))
    p.add_argument("--log-dir", type=str, default=str(BASE_DIR / "logs"))
    p.add_argument("--pose-dir", type=str, default=str(POSE_DIR))
    p.add_argument("--train-csv", type=str, default=str(CSV_DIR / "train.csv"))
    p.add_argument("--val-csv", type=str, default=str(CSV_DIR / "val.csv"))
    p.add_argument("--train-pose-map", type=str,
                   default=str(CSV_DIR / "pose_map_train.csv"))
    p.add_argument("--val-pose-map", type=str,
                   default=str(CSV_DIR / "pose_map_val.csv"))
    return p.parse_args()


def main():
    args = parse_args()
    seed_everything(42)

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    os.makedirs(args.save_dir, exist_ok=True)
    os.makedirs(args.log_dir, exist_ok=True)

    # ---- Data ----
    train_transforms = Compose([ShearTransform(0.1), RotationTransform(0.1)])

    train_ds = ASLCitizenDataset(
        pose_dir=args.pose_dir,
        csv_file=args.train_csv,
        pose_map_file=args.train_pose_map,
        transforms=train_transforms,
        max_frames=args.max_frames,
    )
    val_ds = ASLCitizenDataset(
        pose_dir=args.pose_dir,
        csv_file=args.val_csv,
        pose_map_file=args.val_pose_map,
        gloss_dict=train_ds.gloss_dict,
        max_frames=args.max_frames,
    )

    n_classes = len(train_ds.gloss_dict)
    print(f"Classes: {n_classes}  |  Train: {len(train_ds)}  |  Val: {len(val_ds)}")

    g = torch.Generator()
    g.manual_seed(42)

    loader_kwargs = dict(pin_memory=(device != "cpu"), worker_init_fn=seed_worker,
                         generator=g)
    if args.num_workers > 0:
        loader_kwargs["persistent_workers"] = True
        loader_kwargs["prefetch_factor"] = 2

    train_loader = torch.utils.data.DataLoader(
        train_ds, batch_size=args.batch_size, shuffle=True,
        num_workers=args.num_workers, **loader_kwargs,
    )
    val_loader = torch.utils.data.DataLoader(
        val_ds, batch_size=args.batch_size * 2, shuffle=False,
        num_workers=args.num_workers, drop_last=False, **loader_kwargs,
    )

    # ---- Model ----
    stgcn = STGCN(in_channels=IN_CHANNELS, graph_args=GRAPH_ARGS,
                  edge_importance_weighting=True, n_out_features=args.n_features)
    fc = FC(n_features=args.n_features, num_class=n_classes,
            dropout_ratio=args.dropout)
    model = Network(encoder=stgcn, decoder=fc).to(device)

    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Trainable parameters: {n_params:,}")

    optimizer = optim.AdamW(model.parameters(), lr=args.lr,
                            weight_decay=args.weight_decay)
    steps_per_epoch = len(train_loader)
    scheduler = get_warmup_cosine_scheduler(optimizer, args.warmup_epochs,
                                            args.epochs, steps_per_epoch)
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)

    # ---- Training loop ----
    best_val_acc = 0.0
    history = []

    for epoch in range(1, args.epochs + 1):
        epoch_log = {"epoch": epoch}

        for phase in ("train", "val"):
            is_train = phase == "train"
            model.train(is_train)
            loader = train_loader if is_train else val_loader

            running_loss = 0.0
            correct = 0
            correct_top5 = 0
            total = 0
            grad_norms = []

            with torch.set_grad_enabled(is_train):
                for inputs, _names, labels in tqdm(loader,
                                                   desc=f"Epoch {epoch} {phase}"):
                    inputs = inputs.to(device, non_blocking=True)
                    labels = labels.to(device, non_blocking=True)

                    outputs = model(inputs)
                    loss = criterion(outputs, labels)

                    if is_train:
                        optimizer.zero_grad(set_to_none=True)
                        loss.backward()
                        if args.grad_clip > 0:
                            nn.utils.clip_grad_norm_(model.parameters(),
                                                     args.grad_clip)
                        grad_norms.append(compute_grad_norm(model))
                        optimizer.step()
                        scheduler.step()

                    batch_size = inputs.size(0)
                    running_loss += loss.item() * batch_size
                    pred = outputs.argmax(dim=1)
                    correct += (pred == labels).sum().item()
                    _, top5_pred = outputs.topk(5, dim=1)
                    correct_top5 += (top5_pred == labels.unsqueeze(1)).any(
                        dim=1).sum().item()
                    total += batch_size

            avg_loss = running_loss / max(total, 1)
            acc = correct / max(total, 1)
            top5_acc = correct_top5 / max(total, 1)
            current_lr = optimizer.param_groups[0]["lr"]

            epoch_log[f"{phase}_loss"] = avg_loss
            epoch_log[f"{phase}_acc"] = acc
            epoch_log[f"{phase}_top5"] = top5_acc
            if grad_norms:
                epoch_log["grad_norm_mean"] = np.mean(grad_norms)
                epoch_log["grad_norm_max"] = np.max(grad_norms)
            epoch_log["lr"] = current_lr

            msg = (f"Epoch {epoch:3d} {phase:5s}  "
                   f"Loss: {avg_loss:.4f}  "
                   f"Acc: {acc:.4f}  "
                   f"Top5: {top5_acc:.4f}  "
                   f"LR: {current_lr:.6f}")
            if grad_norms:
                msg += f"  GradNorm: {np.mean(grad_norms):.4f}"
            print(msg)

        history.append(epoch_log)

        # Save epoch log
        log_path = Path(args.log_dir) / "training_log.json"
        with open(log_path, "w") as f:
            json.dump(history, f, indent=2)

        val_acc = epoch_log["val_acc"]
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), Path(args.save_dir) / "best_model.pt")
            print(f"  -> New best model (val_acc={best_val_acc:.4f})")

        if epoch % 5 == 0:
            ckpt_name = f"stgcn_e{epoch:03d}_{val_acc:.4f}.pt"
            torch.save(model.state_dict(), Path(args.save_dir) / ckpt_name)

    # Save gloss dict for deployment
    gloss_path = Path(args.save_dir) / "gloss_dict.json"
    with open(gloss_path, "w") as f:
        json.dump(train_ds.gloss_dict, f, indent=2)
    print(f"\nGloss dict saved to {gloss_path}")
    print(f"Best validation accuracy: {best_val_acc:.4f}")


if __name__ == "__main__":
    main()
