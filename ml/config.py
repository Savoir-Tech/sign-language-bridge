"""
Shared configuration for ST-GCN sign language recognition.

Defines the skeleton graph topology, keypoint selection,
and default hyperparameters used by training, evaluation, and inference.
"""

# ---------------------------------------------------------------------------
# MediaPipe Holistic landmark layout (indices in the raw 543-landmark array)
# ---------------------------------------------------------------------------
NUM_POSE_LANDMARKS = 33      # indices 0-32
NUM_HAND_LANDMARKS = 21      # right: 33-53, left: 54-74
NUM_FACE_LANDMARKS = 468     # 75-542 (unused by ST-GCN)
TOTAL_HOLISTIC_LANDMARKS = NUM_POSE_LANDMARKS + 2 * NUM_HAND_LANDMARKS + NUM_FACE_LANDMARKS  # 543

# We only keep pose + both hands (first 75 landmarks)
NUM_UPPER_BODY_LANDMARKS = NUM_POSE_LANDMARKS + 2 * NUM_HAND_LANDMARKS  # 75

# ---------------------------------------------------------------------------
# 27-node skeleton graph
# ---------------------------------------------------------------------------
# After reordering the 75 landmarks to [pose(0:33), left_hand, right_hand],
# we select 27 representative keypoints.
#
# Pose (7):  nose, left-eye-inner, right-eye-inner, left-shoulder,
#            right-shoulder, left-elbow, right-elbow
# Left hand (10): wrist, thumb-tip, index-mcp, index-tip, middle-mcp,
#                 middle-tip, ring-mcp, ring-tip, pinky-mcp, pinky-tip
# Right hand (10): same as left hand
SELECTED_KEYPOINTS = [
    0, 2, 5, 11, 12, 13, 14,                        # pose
    33, 37, 38, 41, 42, 45, 46, 49, 50, 53,         # left hand
    54, 58, 59, 62, 63, 66, 67, 70, 71, 74,         # right hand
]

NUM_NODES = len(SELECTED_KEYPOINTS)  # 27
CENTER_NODE = 0                       # nose

# Edges describe the skeleton connectivity on the 27-node graph (0-indexed).
# Convention: [child, parent]
INWARD_EDGES = [
    [2, 0], [1, 0],                        # eyes → nose
    [0, 3], [0, 4],                        # nose → shoulders
    [3, 5], [4, 6],                        # shoulders → elbows
    [5, 7], [6, 17],                       # elbows → hand wrists
    # left hand
    [7, 8], [7, 9], [9, 10],
    [7, 11], [11, 12],
    [7, 13], [13, 14],
    [7, 15], [15, 16],
    # right hand
    [17, 18], [17, 19], [19, 20],
    [17, 21], [21, 22],
    [17, 23], [23, 24],
    [17, 25], [25, 26],
]

GRAPH_ARGS = {
    "num_nodes": NUM_NODES,
    "center": CENTER_NODE,
    "inward_edges": INWARD_EDGES,
}

# ---------------------------------------------------------------------------
# Model defaults
# ---------------------------------------------------------------------------
IN_CHANNELS = 2           # (x, y) coordinates per keypoint
N_OUT_FEATURES = 256      # ST-GCN output embedding dimension
MAX_FRAMES = 128          # temporal sequence length
DROPOUT_RATIO = 0.05

# ---------------------------------------------------------------------------
# Training defaults
# ---------------------------------------------------------------------------
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
MAX_EPOCHS = 100
SCHEDULER_T_MAX = 10
NUM_WORKERS = 3
