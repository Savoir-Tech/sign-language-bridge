"""
Pose augmentation transforms for ST-GCN training.

All transforms operate on tensors of shape (C, T, V) where C=2.
Adopted from https://github.com/AmitMY/pose-format/
"""

import torch
import numpy as np


class Compose:
    """Apply a sequence of transforms."""

    def __init__(self, transforms):
        self.transforms = transforms

    def __call__(self, x):
        for t in self.transforms:
            x = t(x)
        return x


class ShearTransform:
    """Random 2D shear augmentation.

    Args:
        shear_std: Standard deviation of the shear factor.
    """

    def __init__(self, shear_std: float = 0.2):
        self.shear_std = shear_std

    def __call__(self, data):
        assert data.shape[0] == 2, "Expected (2, T, V) input"
        x = data.permute(1, 2, 0)  # CTV → TVC
        shear_matrix = torch.eye(2)
        shear_matrix[0, 1] = float(np.random.normal(0, self.shear_std))
        result = torch.matmul(x.float(), shear_matrix).permute(2, 0, 1)  # TVC → CTV
        return result


class RotationTransform:
    """Random 2D rotation augmentation.

    Args:
        rotation_std: Standard deviation of the rotation angle (radians).
    """

    def __init__(self, rotation_std: float = 0.2):
        self.rotation_std = rotation_std

    def __call__(self, data):
        assert data.shape[0] == 2, "Expected (2, T, V) input"
        x = data.permute(1, 2, 0)  # CTV → TVC
        angle = float(np.random.normal(0, self.rotation_std))
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        rot = torch.tensor([[cos_a, -sin_a], [sin_a, cos_a]], dtype=torch.float32)
        result = torch.matmul(x.float(), rot).permute(2, 0, 1)  # TVC → CTV
        return result
