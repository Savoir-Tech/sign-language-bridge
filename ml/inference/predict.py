"""
Inference helper for taking input (frames/text) and returning predictions
from the trained ASL models.
"""


def predict(payload):
  """
  Placeholder prediction function.
  """
  # TODO: Load model weights and run real inference.
  return {"message": "Inference placeholder", "input": payload}


if __name__ == "__main__":
  sample = {"example": "payload"}
  print(predict(sample))

