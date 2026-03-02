"""
Train ST-GCN on the ASL Citizen dataset.

Usage:
    python train.py
    python train.py --epochs 50 --batch-size 64 --lr 5e-4 --device cuda:0
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
from tqdm import tqdm

from architecture import STGCN, FC, Network
from config import (
    BATCH_SIZE,
    DROPOUT_RATIO,
    GRAPH_ARGS,
    IN_CHANNELS,
    LEARNING_RATE,
    MAX_EPOCHS,
    MAX_FRAMES,
    N_OUT_FEATURES,
    NUM_WORKERS,
    SCHEDULER_T_MAX,
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
    np.random.seed(42)
    random.seed(42)


def parse_args():
    p = argparse.ArgumentParser(description="Train ST-GCN for ASL recognition")
    p.add_argument("--epochs", type=int, default=MAX_EPOCHS)
    p.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    p.add_argument("--lr", type=float, default=LEARNING_RATE)
    p.add_argument("--max-frames", type=int, default=MAX_FRAMES)
    p.add_argument("--n-features", type=int, default=N_OUT_FEATURES)
    p.add_argument("--dropout", type=float, default=DROPOUT_RATIO)
    p.add_argument("--num-workers", type=int, default=NUM_WORKERS)
    p.add_argument("--scheduler-t-max", type=int, default=SCHEDULER_T_MAX)
    p.add_argument("--device", type=str, default=None,
                   help="Device to train on (auto-detected if omitted)")
    p.add_argument("--save-dir", type=str, default=str(BASE_DIR / "trained_models"))
    p.add_argument("--log-dir", type=str, default=str(BASE_DIR / "logs"))
    p.add_argument("--pose-dir", type=str, default=str(POSE_DIR))
    p.add_argument("--train-csv", type=str, default=str(CSV_DIR / "train.csv"))
    p.add_argument("--val-csv", type=str, default=str(CSV_DIR / "val.csv"))
    p.add_argument("--train-pose-map", type=str, default=str(CSV_DIR / "pose_map_train.csv"))
    p.add_argument("--val-pose-map", type=str, default=str(CSV_DIR / "pose_map_val.csv"))
    return p.parse_args()


def main():
    args = parse_args()
    seed_everything(42)

    device = args.device
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    torch.set_default_dtype(torch.float64)

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
    train_loader = torch.utils.data.DataLoader(
        train_ds, batch_size=args.batch_size, shuffle=True,
        num_workers=args.num_workers, pin_memory=True,
        worker_init_fn=seed_worker, generator=g,
    )
    val_loader = torch.utils.data.DataLoader(
        val_ds, batch_size=args.batch_size * 2, shuffle=False,
        num_workers=1, pin_memory=True, drop_last=False,
        worker_init_fn=seed_worker, generator=g,
    )

    # ---- Model ----
    stgcn = STGCN(in_channels=IN_CHANNELS, graph_args=GRAPH_ARGS, edge_importance_weighting=True,
                  n_out_features=args.n_features)
    fc = FC(n_features=args.n_features, num_class=n_classes, dropout_ratio=args.dropout)
    model = Network(encoder=stgcn, decoder=fc)
    model.to(device)

    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.scheduler_t_max)
    criterion = nn.CrossEntropyLoss()

    # ---- Training loop ----
    best_val_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        log_path = Path(args.log_dir) / f"epoch_{epoch:03d}.txt"
        log_file = open(log_path, "w")

        for phase in ("train", "val"):
            is_train = phase == "train"
            model.train(is_train)
            loader = train_loader if is_train else val_loader

            total_loss = 0.0
            correct = 0
            total = 0
            optimizer.zero_grad()

            for inputs, _names, labels in tqdm(loader, desc=f"Epoch {epoch} {phase}"):
                inputs = inputs.to(device)
                labels = labels.to(device)

                outputs = model(inputs)
                loss = criterion(outputs, labels)

                if is_train:
                    loss.backward()
                    optimizer.step()
                    optimizer.zero_grad()

                total_loss += loss.item() * inputs.size(0)
                pred = outputs.argmax(dim=1)
                true = labels.argmax(dim=1)
                correct += (pred == true).sum().item()
                total += inputs.size(0)

            avg_loss = total_loss / max(total, 1)
            acc = correct / max(total, 1)
            msg = f"Epoch {epoch:3d} {phase:5s}  Loss: {avg_loss:.4f}  Acc: {acc:.4f}"
            print(msg)
            log_file.write(msg + "\n")

            if not is_train:
                scheduler.step()
                if acc > best_val_acc or epoch % 2 == 0:
                    ckpt_name = f"stgcn_e{epoch:03d}_{acc:.4f}.pt"
                    torch.save(model.state_dict(), Path(args.save_dir) / ckpt_name)
                    log_file.write(f"Saved: {ckpt_name}\n")
                if acc > best_val_acc:
                    best_val_acc = acc
                    torch.save(model.state_dict(), Path(args.save_dir) / "best_model.pt")
                    log_file.write("New best model!\n")

        log_file.close()

    # Save gloss dict for deployment
    gloss_path = Path(args.save_dir) / "gloss_dict.json"
    with open(gloss_path, "w") as f:
        json.dump(train_ds.gloss_dict, f, indent=2)
    print(f"Gloss dict saved to {gloss_path}")
    print(f"Best validation accuracy: {best_val_acc:.4f}")


if __name__ == "__main__":
    main()
