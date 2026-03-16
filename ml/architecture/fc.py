"""Fully-connected classification head."""

import torch.nn as nn


class FC(nn.Module):
    """Dropout → BatchNorm → Linear classifier.

    Args:
        n_features: Input embedding dimension.
        num_class: Number of output classes.
        dropout_ratio: Dropout probability.
    """

    def __init__(self, n_features, num_class, dropout_ratio=0.2):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout_ratio)
        self.bn = nn.BatchNorm1d(n_features)
        self.classifier = nn.Linear(n_features, num_class)
        nn.init.xavier_uniform_(self.classifier.weight)
        nn.init.zeros_(self.classifier.bias)

    def forward(self, x):
        x = self.dropout(x)
        x = self.bn(x)
        return self.classifier(x)
