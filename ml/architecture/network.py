"""Encoder-decoder network wrapper."""

import torch.nn as nn


class Network(nn.Module):
    """Combines an encoder backbone with a decoder head."""

    def __init__(self, encoder, decoder):
        super().__init__()
        self.encoder = encoder
        self.decoder = decoder

    def forward(self, x):
        return self.decoder(self.encoder(x))
