import os
import tarfile
import urllib.request
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
import torchvision.models as models
from PIL import Image

# Configuration
DATA_DIR = "data"
FOOD101_URL = "http://data.vision.ee.ethz.ch/cvl/food-101.tar.gz"
BATCH_SIZE = 32
EPOCHS = 10
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"Using device for training: {DEVICE}")

def download_and_extract_food101():
    """
    Downloads and extracts the Food-101 dataset if not already present.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    tar_path = os.path.join(DATA_DIR, "food-101.tar.gz")
    extracted_dir = os.path.join(DATA_DIR, "food-101")
    
    if not os.path.exists(extracted_dir):
        if not os.path.exists(tar_path):
            print("Downloading Food-101 dataset (~5 GB). This will take a while...")
            urllib.request.urlretrieve(FOOD101_URL, tar_path)
            print("Download completed.")
            
        print("Extracting Food-101 dataset archive...")
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(path=DATA_DIR)
        print("Extraction completed.")
        
        # Clean up zip archive to save space
        os.remove(tar_path)
    else:
        print("Food-101 dataset already downloaded and extracted.")

class Food101Dataset(Dataset):
    """
    Custom PyTorch Dataset mapped to Food-101 text splits.
    Reads file paths from meta/train.txt or meta/test.txt.
    """
    def __init__(self, base_dir, split="train", transform=None):
        self.base_dir = base_dir
        self.images_dir = os.path.join(base_dir, "images")
        self.meta_dir = os.path.join(base_dir, "meta")
        self.transform = transform
        
        # Read files listed in meta split
        split_file = os.path.join(self.meta_dir, f"{split}.txt")
        with open(split_file, "r") as f:
            self.image_files = [line.strip() + ".jpg" for line in f]
            
        # Extract class names and indices
        classes_file = os.path.join(self.meta_dir, "classes.txt")
        with open(classes_file, "r") as f:
            self.classes = [line.strip() for line in f]
        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, idx):
        img_rel_path = self.image_files[idx]
        img_path = os.path.join(self.images_dir, img_rel_path)
        
        # Open image and convert to RGB
        image = Image.open(img_path).convert("RGB")
        
        # Get label from parent directory name in path
        class_name = img_rel_path.split("/")[0]
        label = self.class_to_idx[class_name]
        
        if self.transform:
            image = self.transform(image)
            
        return image, label

def train_model():
    # 1. Prepare data
    download_and_extract_food101()
    
    # 2. Define augmentations and transformations
    # Train uses resizing, cropping, flips, and color jitters
    train_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.RandomResizedCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Validation uses standard resizing and center crop
    val_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    base_dataset_dir = os.path.join(DATA_DIR, "food-101")
    train_dataset = Food101Dataset(base_dataset_dir, split="train", transform=train_transform)
    val_dataset = Food101Dataset(base_dataset_dir, split="test", transform=val_transform)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2, pin_memory=True)
    
    num_classes = len(train_dataset.classes)
    print(f"Loaded {len(train_dataset)} training images and {len(val_dataset)} validation images.")
    print(f"Number of classes: {num_classes}")

    # 3. Instantiate MobileNetV2
    print("Initializing MobileNetV2 with pre-trained ImageNet weights...")
    model = models.mobilenet_v2(weights=models.MobileNetV2_Weights.DEFAULT)
    
    # Modify the classification head for 101 outputs
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    model = model.to(DEVICE)
    
    # Loss and Optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=3, gamma=0.1)

    # 4. Training loop
    best_acc = 0.0
    os.makedirs("models", exist_ok=True)
    save_path = os.path.join("models", "mobilenetv2_food101.pth")
    
    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        corrects = 0
        total = 0
        
        print(f"\nEpoch {epoch+1}/{EPOCHS}")
        print("-" * 10)
        
        for images, labels in train_loader:
            images = images.to(DEVICE)
            labels = labels.to(DEVICE)
            
            optimizer.zero_grad()
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            corrects += torch.sum(preds == labels.data).item()
            total += labels.size(0)
            
        epoch_loss = running_loss / total
        epoch_acc = corrects / total
        print(f"Train Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}")
        
        # Adjust learning rate step
        scheduler.step()
        
        # Validation phase
        model.eval()
        val_loss = 0.0
        val_corrects = 0
        val_total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(DEVICE)
                labels = labels.to(DEVICE)
                
                outputs = model(images)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_corrects += torch.sum(preds == labels.data).item()
                val_total += labels.size(0)
                
        val_epoch_loss = val_loss / val_total
        val_epoch_acc = val_corrects / val_total
        print(f"Val Loss: {val_epoch_loss:.4f} Acc: {val_epoch_acc:.4f}")
        
        # Save best model
        if val_epoch_acc > best_acc:
            best_acc = val_epoch_acc
            torch.save(model.state_dict(), save_path)
            print(f"Saved new best model checkpoint to {save_path}")

    print("Training finished.")

if __name__ == "__main__":
    train_model()
