"""
Extract MediaPipe Holistic keypoints from ASL Citizen videos.

Uses mp.solutions.holistic to extract per-video .npy arrays of shape
(num_frames, 543, 2) containing (x, y) for all holistic landmarks:
  [0:33]   pose landmarks
  [33:54]  right hand landmarks
  [54:75]  left hand landmarks
  [75:543] face landmarks

Only pose + hands (first 75) are used by the ST-GCN model; face landmarks
are extracted for completeness and compatibility with the reference pipeline.

Also produces a pose_map CSV mapping video filenames to pose filenames.

Usage:
    python extract_poses.py --split train
    python extract_poses.py --split val --num-videos 100
"""

import argparse
import csv
import os
import sys
from pathlib import Path
from timeit import default_timer as timer

import cv2
import mediapipe as mp
import numpy as np

mp_holistic = mp.solutions.holistic

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "ASL_Citizen" / "videos"
POSE_DIR = DATA_DIR / "processed" / "pose_files"
CSV_DIR = DATA_DIR / "data_csv"

NUM_POSE = 33
NUM_HAND = 21
NUM_FACE = 468
TOTAL_LANDMARKS = NUM_POSE + 2 * NUM_HAND + NUM_FACE  # 543


def extract_holistic_landmarks(video_path, holistic):
    """Run MediaPipe Holistic on a video and return (T, 543, 2) landmarks."""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return np.zeros((0, TOTAL_LANDMARKS, 2))

    features = np.zeros((total_frames, TOTAL_LANDMARKS, 2))
    frame_idx = 0

    while True:
        success, image = cap.read()
        if not success:
            break

        results = holistic.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

        if results.pose_landmarks:
            for i in range(NUM_POSE):
                features[frame_idx][i][0] = results.pose_landmarks.landmark[i].x
                features[frame_idx][i][1] = results.pose_landmarks.landmark[i].y

        if results.right_hand_landmarks:
            j = NUM_POSE  # 33
            for i in range(NUM_HAND):
                features[frame_idx][i + j][0] = results.right_hand_landmarks.landmark[i].x
                features[frame_idx][i + j][1] = results.right_hand_landmarks.landmark[i].y

        if results.left_hand_landmarks:
            j = NUM_POSE + NUM_HAND  # 54
            for i in range(NUM_HAND):
                features[frame_idx][i + j][0] = results.left_hand_landmarks.landmark[i].x
                features[frame_idx][i + j][1] = results.left_hand_landmarks.landmark[i].y

        if results.face_landmarks:
            j = NUM_POSE + 2 * NUM_HAND  # 75
            for i in range(NUM_FACE):
                features[frame_idx][i + j][0] = results.face_landmarks.landmark[i].x
                features[frame_idx][i + j][1] = results.face_landmarks.landmark[i].y

        frame_idx += 1

    cap.release()
    return features[:frame_idx]


def main():
    parser = argparse.ArgumentParser(description="Extract MediaPipe Holistic keypoints")
    parser.add_argument("--split", required=True, choices=["train", "val", "test"])
    parser.add_argument("--num-videos", type=int, default=None,
                        help="Process only the first N videos (for debugging)")
    parser.add_argument("--video-dir", type=str, default=str(VIDEO_DIR))
    parser.add_argument("--pose-dir", type=str, default=str(POSE_DIR))
    args = parser.parse_args()

    video_dir = Path(args.video_dir)
    pose_dir = Path(args.pose_dir)
    pose_dir.mkdir(parents=True, exist_ok=True)

    csv_path = CSV_DIR / f"{args.split}.csv"
    if not csv_path.exists():
        sys.exit(f"Split CSV not found: {csv_path}")

    pose_map_rows = []
    count = 0
    start = timer()

    with open(csv_path, "r", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            vid_fname = row[1]
            vid_path = str(video_dir / vid_fname)

            if not os.path.isfile(vid_path):
                print(f"[SKIP] Video not found: {vid_path}")
                continue

            pose_fname = Path(vid_fname).stem + ".npy"
            pose_path = str(pose_dir / pose_fname)

            with mp_holistic.Holistic(
                static_image_mode=False, min_detection_confidence=0.5
            ) as holistic:
                features = extract_holistic_landmarks(vid_path, holistic)

            np.save(pose_path, features)
            pose_map_rows.append([vid_fname, pose_fname])

            count += 1
            if count % 10 == 0:
                elapsed = timer() - start
                print(f"[{args.split}] Processed {count} videos ({elapsed:.1f}s)")
                start = timer()

            if args.num_videos and count >= args.num_videos:
                break

    pose_map_path = CSV_DIR / f"pose_map_{args.split}.csv"
    with open(pose_map_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(pose_map_rows)

    print(f"Done: {count} videos extracted for '{args.split}' split")
    print(f"Pose map saved to {pose_map_path}")


if __name__ == "__main__":
    main()
