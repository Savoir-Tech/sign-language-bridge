"""
Evaluate a trained ST-GCN model on the ASL Citizen test set.

Outputs top-1/5/10/20 accuracy, DCG, MRR, confusion matrices,
and per-user statistics.

Usage:
    python test.py --checkpoint trained_models/best_model.pt
"""

import argparse
import csv
import json
import math
import os
from operator import add
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm

from architecture import STGCN, FC, Network
from config import (
    DROPOUT_RATIO,
    GRAPH_ARGS,
    IN_CHANNELS,
    MAX_FRAMES,
    N_OUT_FEATURES,
)
from dataset import ASLCitizenDataset

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
POSE_DIR = DATA_DIR / "processed" / "pose_files"
CSV_DIR = DATA_DIR / "data_csv"


def eval_metrics(sorted_args, label):
    """Return (rank, [DCG, Top1, Top5, Top10, Top20, MRR]) for a single sample."""
    (res,) = np.where(sorted_args == label)
    rank = res[0]
    dcg = 1 / math.log2(rank + 2)
    mrr = 1 / (rank + 1)
    return rank, [
        dcg,
        int(rank < 1),
        int(rank < 5),
        int(rank < 10),
        int(rank < 20),
        mrr,
    ]


def parse_args():
    p = argparse.ArgumentParser(description="Evaluate ST-GCN on ASL Citizen test set")
    p.add_argument("--checkpoint", type=str, required=True, help="Path to model .pt file")
    p.add_argument("--device", type=str, default=None)
    p.add_argument("--max-frames", type=int, default=MAX_FRAMES)
    p.add_argument("--output-dir", type=str, default=str(BASE_DIR / "results"))
    p.add_argument("--pose-dir", type=str, default=str(POSE_DIR))
    p.add_argument("--train-csv", type=str, default=str(CSV_DIR / "train.csv"))
    p.add_argument("--test-csv", type=str, default=str(CSV_DIR / "test.csv"))
    p.add_argument("--train-pose-map", type=str, default=str(CSV_DIR / "pose_map_train.csv"))
    p.add_argument("--test-pose-map", type=str, default=str(CSV_DIR / "pose_map_test.csv"))
    return p.parse_args()


def main():
    args = parse_args()
    torch.set_default_dtype(torch.float64)

    device = args.device
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    os.makedirs(args.output_dir, exist_ok=True)

    # Build gloss dict from training set
    train_ds = ASLCitizenDataset(
        pose_dir=args.pose_dir,
        csv_file=args.train_csv,
        pose_map_file=args.train_pose_map,
        max_frames=args.max_frames,
    )
    gloss_dict = train_ds.gloss_dict
    n_classes = len(gloss_dict)
    idx2gloss = {v: k for k, v in gloss_dict.items()}

    test_ds = ASLCitizenDataset(
        pose_dir=args.pose_dir,
        csv_file=args.test_csv,
        pose_map_file=args.test_pose_map,
        gloss_dict=gloss_dict,
        max_frames=args.max_frames,
    )
    test_loader = torch.utils.data.DataLoader(
        test_ds, batch_size=1, shuffle=False, num_workers=2, pin_memory=True,
    )

    # Load model
    stgcn = STGCN(in_channels=IN_CHANNELS, graph_args=GRAPH_ARGS, edge_importance_weighting=True,
                  n_out_features=N_OUT_FEATURES)
    fc = FC(n_features=N_OUT_FEATURES, num_class=n_classes, dropout_ratio=DROPOUT_RATIO)
    model = Network(encoder=stgcn, decoder=fc)
    model.load_state_dict(torch.load(args.checkpoint, map_location=device))
    model.to(device)
    model.eval()

    # Evaluate
    totals = [0.0] * 6  # DCG, Top1, Top5, Top10, Top20, MRR
    count_total = 0
    conf_matrix = np.zeros((n_classes, n_classes), dtype=int)
    user_stats = {}
    user_counts = {}

    with torch.no_grad():
        for inputs, name, labels in tqdm(test_loader, desc="Evaluating"):
            inputs = inputs.to(device)
            labels = labels.to(device)

            predictions = model(inputs)
            probs = torch.softmax(predictions, dim=1)
            sorted_indices = torch.argsort(probs, dim=1, descending=True)
            true_indices = torch.argmax(labels, dim=1)

            for i in range(len(sorted_indices)):
                pred = sorted_indices[i].cpu().numpy()
                gt = true_indices[i].cpu().numpy()

                _, counts = eval_metrics(pred, gt)
                totals = list(map(add, counts, totals))
                count_total += 1

                conf_matrix[gt, pred[0]] += 1

                user = name["user"][i]
                if user not in user_counts:
                    user_counts[user] = 0
                    user_stats[user] = [0.0] * 6
                user_counts[user] += 1
                user_stats[user] = list(map(add, counts, user_stats[user]))

    # Write results
    out = Path(args.output_dir)

    with open(out / "metrics.txt", "w") as f:
        f.write(f"Total samples: {count_total}\n")
        labels_list = ["DCG", "Top-1", "Top-5", "Top-10", "Top-20", "MRR"]
        for name_str, val in zip(labels_list, totals):
            f.write(f"{name_str}: {val / count_total:.6f}\n")
    print(f"\n{'Metric':<10} Value")
    print("-" * 25)
    for name_str, val in zip(labels_list, totals):
        print(f"{name_str:<10} {val / count_total:.6f}")

    with open(out / "user_stats.txt", "w") as f:
        for u in sorted(user_counts):
            f.write(f"User: {u}  ({user_counts[u]} samples)\n")
            for name_str, val in zip(labels_list, user_stats[u]):
                f.write(f"  {name_str}: {val / user_counts[u]:.6f}\n")
            f.write("\n")

    np.savetxt(str(out / "confusion_matrix.txt"), conf_matrix, fmt="%d")

    with open(out / "confusion_mini.csv", "w", newline="") as f:
        writer = csv.writer(f)
        for i in range(n_classes):
            row_counts = conf_matrix[i]
            total_for_gloss = np.sum(row_counts)
            acc = conf_matrix[i, i] / total_for_gloss if total_for_gloss > 0 else 0
            top5 = row_counts.argsort()[::-1][:5]
            row = [idx2gloss[i], f"{acc:.4f}"]
            for j in top5:
                row.extend([idx2gloss[j], str(conf_matrix[i, j])])
            writer.writerow(row)

    print(f"\nResults saved to {out}/")


if __name__ == "__main__":
    main()
