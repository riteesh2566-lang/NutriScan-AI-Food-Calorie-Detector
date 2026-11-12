# 🥗 NutriScan – AI Food Calorie Detector

### AI-Powered Food Recognition & Nutritional Analysis System

NutriScan is an AI-powered food recognition application that identifies food items from images and provides nutritional information, including estimated calorie values.

The application combines Deep Learning, Computer Vision, REST APIs and Database Management to simplify food tracking and nutritional analysis.

Users can upload a food image, process it through AI models and view the predicted food category along with available nutritional information.

---

## 🚀 Key Features

- 📸 **Food Image Upload:** Upload food images for AI-based analysis.
- 🤖 **AI Food Recognition:** Uses deep-learning models for food identification.
- 🎯 **Object Detection:** YOLOv8 identifies objects and their locations.
- 🧠 **Food Classification:** MobileNetV2 classifies food images into supported categories.
- 🔥 **Calorie Estimation:** Provides estimated calorie information based on available nutritional data.
- 🥑 **Nutritional Analysis:** Supports nutritional information lookup.
- 🗄️ **Database Integration:** MySQL database for structured application data.
- ⚡ **REST API:** FastAPI handles communication between frontend and backend.
- 🐳 **Docker Support:** Containerized application for consistent deployment.
- 🌐 **Nginx Integration:** Web server and reverse proxy functionality.

---

## 🏗️ Project Architecture

```text
                 USER
                   |
                   v
             FOOD IMAGE
                   |
                   v
             FRONTEND
          HTML / CSS / JS
                   |
                   v
                 NGINX
                   |
                   v
             FASTAPI BACKEND
                   |
                   v
            IMAGE PROCESSING
             OpenCV / NumPy
                   |
                   v
              YOLOv8 MODEL
             Object Detection
                   |
                   v
             MobileNetV2
            Food Classification
                   |
                   v
             FOOD PREDICTION
                   |
                   v
           NUTRITION LOOKUP
                   |
                   v
              MYSQL DATABASE
                   |
                   v
            RESULT TO USER
```

*The exact model execution sequence and nutrition-data flow depend on the backend implementation.*

---

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| FastAPI | REST API development |
| PyTorch | Deep learning model execution |
| YOLOv8 | Food object detection |
| MobileNetV2 | Food image classification |
| Food-101 | Food image dataset |
| OpenCV | Image processing |
| NumPy | Numerical and array operations |
| MySQL | Relational database |
| SQLAlchemy | Object Relational Mapping |
| PyMySQL | Python-MySQL connectivity |
| HTML5 | Frontend structure |
| CSS3 | Frontend styling |
| JavaScript | Frontend interactions |
| Nginx | Web server and reverse proxy |
| Docker | Application containerization |
| Docker Compose | Multi-container management |
| USDA FoodData Central API | Nutritional data source, where integrated |
| Git & GitHub | Version control and source-code hosting |

---

## 🧠 AI Models

### 1. YOLOv8 – Object Detection

YOLOv8 (You Only Look Once) is used for object detection.

It identifies objects in an image and determines their locations using bounding boxes.

**Model:** `yolov8n.pt`

The Nano variant is selected for its lightweight architecture and efficient inference.

### 2. MobileNetV2 – Food Classification

MobileNetV2 is a lightweight Convolutional Neural Network (CNN) architecture used for image classification.

It helps classify food images into supported food categories.

**Model:** `mobilenetv2_food101.pth`

### 3. Food-101 Dataset

The Food-101 dataset contains:

- 101 food categories.
- 101,000 images.
- 1,000 images per category.

It is commonly used for food image classification and model training.

---

## 📂 Project Structure

```text
NutriScan-AI-Food-Calorie-Detector/
│
├── backend/
│   ├── API and application logic
│   ├── Image processing
│   ├── AI model integration
│   └── Database connectivity
│
├── database/
│   └── Database-related files
│
├── frontend/
│   ├── HTML
│   ├── CSS
│   └── JavaScript
│
├── models/
│   ├── mobilenetv2_food101.pth
│   └── yolov8n.pt
│
├── .gitignore
├── docker-compose.yml
└── nginx.conf
```

---

## ⚙️ Installation and Setup

### Prerequisites

Install the following before running the application:

- Python 3.10 or compatible project version
- Docker Desktop
- Git
- Visual Studio Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/riteesh2566-lang/NutriScan-AI-Food-Calorie-Detector.git
```

### 2. Navigate to the Project Directory

```bash
cd NutriScan-AI-Food-Calorie-Detector
```

### 3. Configure Environment Variables

Create a `.env` file using the environment variables required by your backend and Docker configuration.

Example:

```env
MYSQL_ROOT_PASSWORD=your_secure_password
DATABASE_URL=mysql+pymysql://root:your_secure_password@db:3306/food_calorie_db
USDA_API_KEY=your_api_key
JWT_SECRET=your_secure_secret
```

Use the exact variable names expected by your source code.

**Important:** Never upload your actual `.env` file or production credentials to GitHub.

### 4. Run Using Docker

Build and start the application:

```bash
docker compose up --build
```

To run in the background:

```bash
docker compose up -d --build
```

### 5. Access the Application

Frontend:

```text
http://localhost
```

Backend API:

```text
http://localhost:8000
```

FastAPI Swagger Documentation:

```text
http://localhost:8000/docs
```

These addresses assume your Docker port mappings and FastAPI documentation settings are configured as described.

---

## 🐳 Docker Architecture

The application uses Docker Compose to manage multiple services.

| Container | Technology | Responsibility |
|---|---|---|
| nutriscan-db | MySQL 8.0 | Database management |
| nutriscan-backend | Python / FastAPI | Backend and AI processing |
| nutriscan-frontend | Nginx Alpine | Frontend hosting and request routing |

### Useful Docker Commands

Start application:

```bash
docker compose up --build
```

View running containers:

```bash
docker ps
```

View logs:

```bash
docker compose logs
```

Stop application:

```bash
docker compose down
```

---

## 🔄 Application Workflow

1. User uploads a food image.
2. Frontend sends the image to the FastAPI backend.
3. Backend validates the uploaded image.
4. OpenCV and NumPy perform image-processing operations.
5. YOLOv8 performs object detection.
6. MobileNetV2 performs food classification according to the implemented inference pipeline.
7. Application retrieves or calculates nutritional information.
8. MySQL handles the required database operations.
9. FastAPI returns the prediction response.
10. Frontend displays the result.

---

## 📊 Database

NutriScan uses MySQL as its relational database.

SQLAlchemy provides ORM functionality, while PyMySQL handles database connectivity.

The database can be used to manage structured application information such as food records, user information and prediction history, depending on the implemented schema.

---

## 🔐 Security Considerations

- Store API keys and passwords in environment variables.
- Never commit `.env` files.
- Use secure database credentials.
- Validate uploaded images.
- Handle API errors safely.
- Avoid exposing sensitive information in application logs.
- Use HTTPS for production deployments.

---

## 🔮 Future Enhancements

- Food portion-size estimation.
- Improved calorie prediction accuracy.
- Daily calorie tracking dashboard.
- Personalized nutrition recommendations.
- Food history and analytics.
- Mobile application integration.
- GPU-based inference optimization.
- Additional food categories and datasets.

---

## 🎯 Learning Outcomes

This project demonstrates practical implementation and integration of:

- Python backend development.
- REST API development using FastAPI.
- Deep Learning and Computer Vision.
- CNN-based image classification.
- YOLO-based object detection.
- MySQL database integration.
- Frontend and backend communication.
- Docker containerization.
- Multi-container application deployment.
- External nutritional data integration.

---

## 👨‍💻 Author

**Riteesh S**

GitHub: [riteesh2566-lang](https://github.com/riteesh2566-lang)

Project: [NutriScan – AI Food Calorie Detector](https://github.com/riteesh2566-lang/NutriScan-AI-Food-Calorie-Detector)

---

### ⭐ Support

If you find this project interesting, consider giving the repository a star!

**NutriScan – Making Food Recognition and Nutrition Tracking Smarter with AI.**
