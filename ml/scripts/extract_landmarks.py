"""
Extract hand landmarks from ASL Citizen videos using MediaPipe Hands.

Adapted from ASL Citizen's pose.py, but extracts only hand landmarks:
- 21 landmarks per hand × 2 hands = 42 keypoints
- 3 coordinates (x, y, z) per landmark = 126 features total

This is optimized for sign language recognition vs full body pose.
"""

import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
import argparse
import csv
from tqdm import tqdm
import json

# MediaPipe setup
mp_hands = mp.solutions.hands

# Paths — resolve() ensures absolute path regardless of working directory
ML_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ML_DIR / "data"
VIDEOS_DIR = DATA_DIR / "ASL_Citizen" / "videos"  # Direct path to ASL Citizen videos
POSE_DIR = DATA_DIR / "processed" / "pose_per_files"
CSV_DIR = DATA_DIR / "data_csv"


def extract_hand_landmarks_from_video(video_path: Path, hands_model) -> np.ndarray:
    """
    Extract hand landmarks from all frames of a video.

    Returns:
        landmarks: np.array of shape (num_frames, 42, 3) containing:
            - 21 left hand landmarks × 3 coords (x, y, z)
            - 21 right hand landmarks × 3 coords (x, y, z)
            Total: 42 keypoints × 3 coords = 126 features (flattened)
    """
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    # Get total frames
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if total_frames == 0:
        raise ValueError(f"Video has no frames: {video_path}")

    # Initialize feature array: (frames, 42 keypoints, 3 coords)
    features = np.zeros((total_frames, 42, 3))

    frame_idx = 0
    success = True

    while success:
        success, frame = cap.read()

        if success:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Process with MediaPipe Hands
            results = hands_model.process(rgb_frame)

            # Extract landmarks
            if results.multi_hand_landmarks and results.multi_handedness:
                for hand_idx, (hand_landmarks, handedness) in enumerate(
                    zip(results.multi_hand_landmarks, results.multi_handedness)
                ):
                    # Determine if left or right hand
                    # MediaPipe returns mirrored labels, so we flip them
                    hand_label = handedness.classification[0].label

                    if hand_label == "Left":
                        # Right hand in video (mirrored) → indices 0-20
                        offset = 21
                    else:
                        # Left hand in video (mirrored) → indices 21-41
                        offset = 0

                    # Store landmarks
                    for lm_idx, landmark in enumerate(hand_landmarks.landmark):
                        features[frame_idx][offset + lm_idx][0] = landmark.x
                        features[frame_idx][offset + lm_idx][1] = landmark.y
                        features[frame_idx][offset + lm_idx][2] = landmark.z

            frame_idx += 1

    cap.release()

    return features


def process_asl_citizen_dataset(csv_file: Path, num_videos: int = None):
    """
    Process ASL Citizen dataset from CSV file.

    CSV format: Participant ID, Video file, Gloss, ASL-LEX Code

    Args:
        csv_file: Path to ASL Citizen CSV file (train.csv/val.csv/test.csv)
        num_videos: Maximum number of videos to process (None = all)
    """
    if not csv_file.exists():
        print(f" CSV file not found: {csv_file}")
        print(f"   Expected location: {csv_file}")
        print(f"   Please copy from: ml/data/ASL_Citizen/splits/{csv_file.name}")
        return

    print(f"\n Processing ASL Citizen dataset: {csv_file.name}")
    print(f"   Videos directory: {VIDEOS_DIR}")
    print(f"   Output directory: {POSE_DIR}")

    # Create output directory
    POSE_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize MediaPipe Hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # Read CSV file
    video_list = []
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        header = next(reader)  # Skip header: Participant ID,Video file,Gloss,ASL-LEX Code
        for row in reader:
            video_list.append(row)

    # Limit number of videos if specified
    if num_videos:
        video_list = video_list[:num_videos]

    print(f"   Total videos to process: {len(video_list)}")

    # Process each video
    processed = 0
    failed = 0
    skipped = 0
    pose_mapping = []  # Track video -> pose file mapping

    for row in tqdm(video_list, desc="Extracting landmarks"):
        try:
            participant_id = row[0]  # e.g., "P1"
            video_filename = row[1]  # e.g., "15890366051589533-APPLE.mp4"
            gloss = row[2]  # e.g., "APPLE"

            # Construct video path directly from ASL_Citizen/videos
            video_path = VIDEOS_DIR / video_filename

            if not video_path.exists():
                skipped += 1
                continue

            # Generate output filename (remove .mp4 extension)
            output_name = video_filename[:-4]  # Remove .mp4
            output_path = POSE_DIR / f"{output_name}.npy"

            # Skip if already processed
            if output_path.exists():
                skipped += 1
                pose_mapping.append([video_filename, f"{output_name}.npy"])
                continue

            # Extract landmarks
            features = extract_hand_landmarks_from_video(video_path, hands)

            # Save as numpy array
            np.save(output_path, features)

            # Add to pose mapping
            pose_mapping.append([video_filename, f"{output_name}.npy"])

            processed += 1

        except Exception as e:
            failed += 1
            if failed <= 5:  # Only print first 5 errors
                print(f"\n❌ Error processing {video_filename}: {e}")

    hands.close()

    # Print statistics
    print("\n" + "="*60)
    print(" Landmark Extraction Complete!")
    print("="*60)
    print(f"\n Statistics:")
    print(f"   Total videos: {len(video_list)}")
    print(f"   Processed: {processed}")
    print(f"   Skipped (already exist): {skipped}")
    print(f"   Failed: {failed}")
    print(f"\n Output directory: {POSE_DIR}")
    print(f"   Format: (num_frames, 42, 3) numpy arrays")
    print(f"   Features: 21 left hand + 21 right hand = 42 keypoints × 3 coords")

    # Collect vocabulary from all CSVs (train, val, test)
    print(f"\n Building vocabulary from all splits...")
    vocab = set()

    # Read all CSV files to build complete vocabulary
    for split_csv in CSV_DIR.glob("*.csv"):
        if split_csv.name.startswith("pose_map"):
            continue  # Skip pose mapping files
        try:
            with open(split_csv, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                for row in reader:
                    if len(row) >= 3:
                        vocab.add(row[2].strip())  # gloss
        except:
            pass

    vocab = sorted(list(vocab))
    vocab_dict = {sign: idx for idx, sign in enumerate(vocab)}

    # Save vocabulary
    vocab_path = DATA_DIR / "sign_vocab.json"
    with open(vocab_path, 'w') as f:
        json.dump(vocab_dict, f, indent=2)

    print(f" Vocabulary saved: {vocab_path}")
    print(f"   Total signs: {len(vocab)}")

    # Create pose mapping CSV (for compatibility with ASL Citizen dataset loader)
    # Format: video_filename, pose_filename.npy
    split_name = csv_file.stem  # train, val, or test
    pose_map_path = CSV_DIR / f"pose_map_{split_name}.csv"

    with open(pose_map_path, 'w', newline='') as f:
        writer = csv.writer(f)
        for mapping in pose_mapping:
            writer.writerow(mapping)

    print(f" Pose mapping saved: {pose_map_path}")
    print(f"   Entries: {len(pose_mapping)}")

    print("\n Next steps:")
    print("   1. Repeat for other splits if needed:")
    print("      python ml/scripts/extract_landmarks.py --split val")
    print("      python ml/scripts/extract_landmarks.py --split test")
    print("   2. Run training: jupyter notebook ml/notebooks/train_asl_citizen.ipynb")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract hand landmarks from ASL Citizen videos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process training set (all videos)
  python extract_landmarks.py --split train

  # Process first 1000 videos (for testing)
  python extract_landmarks.py --split train --num-videos 1000

  # Process validation set
  python extract_landmarks.py --split val

  # Process test set
  python extract_landmarks.py --split test
        """
    )
    parser.add_argument(
        "--split",
        type=str,
        default="train",
        choices=["train", "val", "test"],
        help="Dataset split to process (default: train)"
    )
    parser.add_argument(
        "--num-videos",
        type=int,
        default=None,
        help="Maximum number of videos to process (default: all)"
    )

    args = parser.parse_args()

    csv_file = CSV_DIR / f"{args.split}.csv"
    process_asl_citizen_dataset(csv_file, num_videos=args.num_videos)
