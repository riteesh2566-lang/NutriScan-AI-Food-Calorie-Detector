-- AI Food Detection and Calorie Calculator Database Schema
-- Target Database: MySQL 8.0+

CREATE DATABASE IF NOT EXISTS food_calorie_db;
USE food_calorie_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    age INT DEFAULT NULL,
    gender VARCHAR(20) DEFAULT NULL,
    weight_kg FLOAT DEFAULT NULL,
    height_cm FLOAT DEFAULT NULL,
    target_weight FLOAT DEFAULT NULL,
    activity_level VARCHAR(30) DEFAULT 'sedentary',
    bmi FLOAT DEFAULT NULL,
    bmi_category VARCHAR(20) DEFAULT NULL,
    daily_calorie_target INT NOT NULL DEFAULT 2000,
    protein_goal FLOAT DEFAULT NULL,
    carbs_goal FLOAT DEFAULT NULL,
    fat_goal FLOAT DEFAULT NULL,
    water_goal FLOAT DEFAULT NULL,
    fiber_goal FLOAT DEFAULT NULL,
    units_preference VARCHAR(10) DEFAULT 'metric',
    notif_health BOOLEAN DEFAULT TRUE,
    notif_calorie_reminders BOOLEAN DEFAULT TRUE,
    notif_weekly_reports BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NULL,
    INDEX idx_users_username (username),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Food History Log Table
CREATE TABLE IF NOT EXISTS food_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    image_path VARCHAR(255) DEFAULT NULL,
    total_calories FLOAT NOT NULL DEFAULT 0.0,
    total_protein FLOAT NOT NULL DEFAULT 0.0,
    total_carbs FLOAT NOT NULL DEFAULT 0.0,
    total_fat FLOAT NOT NULL DEFAULT 0.0,
    total_fiber FLOAT NOT NULL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_history_user (user_id),
    INDEX idx_history_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Individual Food Item Detections Table
CREATE TABLE IF NOT EXISTS food_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    confidence FLOAT NOT NULL,
    xmin FLOAT NOT NULL,
    ymin FLOAT NOT NULL,
    xmax FLOAT NOT NULL,
    ymax FLOAT NOT NULL,
    quantity FLOAT NOT NULL DEFAULT 1.0,
    serving_size VARCHAR(50) NOT NULL DEFAULT '100g',
    calories FLOAT NOT NULL DEFAULT 0.0,
    protein FLOAT NOT NULL DEFAULT 0.0,
    carbs FLOAT NOT NULL DEFAULT 0.0,
    fat FLOAT NOT NULL DEFAULT 0.0,
    fiber FLOAT NOT NULL DEFAULT 0.0,
    CONSTRAINT fk_items_history FOREIGN KEY (history_id) REFERENCES food_history(id) ON DELETE CASCADE,
    INDEX idx_items_history (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Nutrition Cache Cache Table (USDA FDC Cache)
CREATE TABLE IF NOT EXISTS nutrition_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    food_name VARCHAR(100) UNIQUE NOT NULL,
    calories FLOAT NOT NULL DEFAULT 0.0,
    protein FLOAT NOT NULL DEFAULT 0.0,
    carbs FLOAT NOT NULL DEFAULT 0.0,
    fat FLOAT NOT NULL DEFAULT 0.0,
    fiber FLOAT NOT NULL DEFAULT 0.0,
    serving_size VARCHAR(50) NOT NULL DEFAULT '100g',
    usda_fdc_id VARCHAR(20) DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_nutrition_food (food_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
