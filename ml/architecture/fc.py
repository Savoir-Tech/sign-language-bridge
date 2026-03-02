"""Fully-connected classification head."""

import math
import torch.nn as nn


class FC(nn.Module):
    """Dropout → optional BatchNorm → Linear classifier.

    Args:
        n_features: Input embedding dimension.
        num_class: Number of output classes.
        dropout_ratio: Dropout probability.
        batch_norm: Whether to apply BatchNorm before the classifier.
    """

    def __init__(self, n_features, num_class, dropout_ratio=0.2, batch_norm=False):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout_ratio)
        self.use_bn = batch_norm
        if batch_norm:
            self.bn = nn.BatchNorm1d(n_features)
            self.bn.weight.data.fill_(1)
            self.bn.bias.data.zero_()
        self.classifier = nn.Linear(n_features, num_class)
        nn.init.normal_(self.classifier.weight, 0, math.sqrt(2.0 / num_class))

    def forward(self, x):
        x = self.dropout(x)
        if self.use_bn:
            x = self.bn(x)
        return self.classifier(x)
