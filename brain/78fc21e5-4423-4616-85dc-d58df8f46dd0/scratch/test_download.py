import os
import urllib.request
import torch
import torchvision.models as models

url = "https://huggingface.co/AlexKoff88/mobilenet_v2_food101/resolve/main/pytorch_model.bin"
dest = "test_pytorch_model.bin"

print("Downloading model weights...")
try:
    urllib.request.urlretrieve(url, dest)
    print("Download completed. Size:", os.path.getsize(dest))
    
    print("Testing PyTorch load...")
    checkpoint = torch.load(dest, map_location="cpu")
    print("Keys in checkpoint:", checkpoint.keys() if isinstance(checkpoint, dict) else type(checkpoint))
    
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    else:
        state_dict = checkpoint
        
    first_keys = list(state_dict.keys())[:5]
    print("First few state_dict keys:", first_keys)
    
    # Load into model
    model = models.mobilenet_v2(num_classes=101)
    
    # Check if we need to strip module. prefix
    if any(k.startswith("module.") for k in state_dict.keys()):
        state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
        print("Stripped 'module.' prefix.")
        
    model.load_state_dict(state_dict)
    print("Success! Model loaded state_dict perfectly.")
    
finally:
    if os.path.exists(dest):
        os.remove(dest)
        print("Cleaned up test file.")
