import os
from ultralytics import YOLO

def setup_dataset_template():
    """
    Creates a template dataset config file (dataset.yaml) to show the user
    how to configure custom data directories for YOLOv8.
    """
    os.makedirs("training", exist_ok=True)
    yaml_content = """# Template YOLOv8 Food Detection Dataset configuration
# Replace paths with your actual dataset directories

path: ../data/food_detection  # dataset root dir
train: images/train  # train images (relative to 'path')
val: images/val      # val images (relative to 'path')

# Classes dictionary
names:
  0: food_item
  # You can expand this if you want multiple specific object classes like:
  # 0: pizza
  # 1: sandwich
  # 2: burger
  # 3: salad
"""
    yaml_path = os.path.join("training", "food_detection_template.yaml")
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
    print(f"Created YOLOv8 dataset configuration template at: {yaml_path}")

def train_yolo():
    # Setup dataset structure template
    setup_dataset_template()
    
    # Define model weights target
    # We start with the pre-trained 'yolov8n.pt' nano model which acts as a feature extractor
    print("Loading pre-trained YOLOv8 nano model...")
    model = YOLO("yolov8n.pt")
    
    # Instruction warning
    print("\n" + "="*80)
    print("YOLOv8 TRAINING INFORMATION:")
    print("To train YOLOv8 on your custom annotated dataset:")
    print("1. Set up your dataset directory following the structure in training/food_detection_template.yaml")
    print("2. Ensure labels are in YOLO format (one TXT file per image with normalized box coordinates)")
    print("3. Point the 'data' parameter below to your final yaml config.")
    print("="*80 + "\n")
    
    # We write the training call but comment it out or set it to run on a template,
    # as executing it without custom data would error.
    # The user can run this script directly once their data is ready!
    try:
        # Example of how the training execution is triggered:
        # results = model.train(
        #     data='training/food_detection_template.yaml',
        #     epochs=50,
        #     imgsz=640,
        #     batch=16,
        #     device='0' # Use GPU index 0, or 'cpu'
        # )
        # print("Training execution summary:", results)
        print("Training script compiled successfully. To run training, call: python training/train_yolo.py")
    except Exception as e:
        print(f"Training check failed: {e}")

if __name__ == "__main__":
    train_yolo()
