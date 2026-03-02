"""
ASL Citizen dataset loader for ST-GCN.

Loads pre-extracted MediaPipe Holistic pose files (.npy), normalizes,
selects the 27-keypoint subset, and returns tensors of shape (C, T, V)
= (2, 128, 27) ready for the ST-GCN backbone.
"""

import csv
from pathlib import Path

import numpy as np
import torch
import torch.utils.data as data_utl

from config import (
    MAX_FRAMES,
    NUM_POSE_LANDMARKS,
    NUM_HAND_LANDMARKS,
    NUM_UPPER_BODY_LANDMARKS,
    SELECTED_KEYPOINTS,
)


def downsample(frames: np.ndarray, max_frames: int) -> np.ndarray:
    """Uniformly downsample a frame sequence to at most *max_frames*."""
    length = frames.shape[0]
    increment = max_frames / length
    if increment > 1.0:
        increment = 1.0
    curr_increment = 0.0
    curr_frame = 0
    selected = []
    for f in frames:
        curr_increment += increment
        if curr_increment > curr_frame:
            curr_frame += 1
            selected.append(f)
    if len(selected) > max_frames:
        selected = selected[:max_frames]
    return np.array(selected)


class ASLCitizenDataset(data_utl.Dataset):
    """PyTorch dataset for ASL Citizen with ST-GCN preprocessing.

    Args:
        pose_dir: Directory containing ``.npy`` pose files.
        csv_file: Path to the split CSV (columns: participant, video, gloss, lex_code).
        pose_map_file: Path to CSV mapping video filenames → pose filenames.
        gloss_dict: Pre-built ``{gloss: index}`` mapping. If *None*, built from ``csv_file``.
        transforms: Optional callable applied to the (C, T, V) tensor.
        max_frames: Temporal length to pad/downsample to.
    """

    def __init__(self, pose_dir, csv_file, pose_map_file, gloss_dict=None,
                 transforms=None, max_frames=MAX_FRAMES):
        self.max_frames = max_frames
        self.transforms = transforms
        self.pose_paths = []
        self.video_info = []
        self.labels = []

        if gloss_dict is None:
            gloss_set = set()
            with open(csv_file, "r", newline="") as f:
                reader = csv.reader(f)
                next(reader, None)
                for row in reader:
                    gloss_set.add(row[2].strip())
            self.gloss_dict = {g: i for i, g in enumerate(sorted(gloss_set))}
        else:
            self.gloss_dict = gloss_dict

        vid_to_pose = {}
        with open(pose_map_file, "r", newline="") as f:
            for row in csv.reader(f):
                vid_to_pose[row[0]] = row[1]

        pose_dir = Path(pose_dir)
        with open(csv_file, "r", newline="") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                vid_fname = row[1]
                if vid_fname not in vid_to_pose:
                    continue
                self.pose_paths.append(str(pose_dir / vid_to_pose[vid_fname]))
                self.video_info.append(row)
                self.labels.append(self.gloss_dict[row[2].strip()])

    def __len__(self):
        return len(self.pose_paths)

    def __getitem__(self, index):
        data = np.load(self.pose_paths[index])
        label_idx = self.labels[index]

        # One-hot label
        label = np.zeros(len(self.gloss_dict), dtype=np.float64)
        label[label_idx] = 1.0

        # Temporal adjustment
        if data.shape[0] > self.max_frames:
            data = downsample(data, self.max_frames)
        if data.shape[0] < self.max_frames:
            data = np.pad(data, ((0, self.max_frames - data.shape[0]), (0, 0), (0, 0)))

        # Normalize using mean shoulder distance and center
        shoulder_l = data[:, 11, :]  # left shoulder
        shoulder_r = data[:, 12, :]  # right shoulder
        center = np.mean((shoulder_l + shoulder_r) / 2, axis=0)
        mean_dist = np.mean(np.sqrt(((shoulder_l - shoulder_r) ** 2).sum(-1)))
        if mean_dist > 0:
            data = (data - center) / mean_dist

        # Keep only pose + hands (first 75 landmarks), reorder to [pose, LH, RH]
        data = data[:, :NUM_UPPER_BODY_LANDMARKS, :]
        pose = data[:, :NUM_POSE_LANDMARKS, :]
        rh = data[:, NUM_POSE_LANDMARKS:NUM_POSE_LANDMARKS + NUM_HAND_LANDMARKS, :]
        lh = data[:, NUM_POSE_LANDMARKS + NUM_HAND_LANDMARKS:, :]
        data = np.concatenate([pose, lh, rh], axis=1)

        # Select the 27-keypoint subset and transpose to (C, T, V)
        data = data[:, SELECTED_KEYPOINTS, :]
        data = np.transpose(data, (2, 0, 1))  # (T, V, C) → (C, T, V)

        tensor = torch.from_numpy(data)
        if self.transforms:
            tensor = self.transforms(tensor)

        info = self.video_info[index]
        name_dict = {"user": info[0], "filename": info[1], "gloss": info[2]}

        return tensor.double(), name_dict, torch.tensor(label, dtype=torch.float64)
