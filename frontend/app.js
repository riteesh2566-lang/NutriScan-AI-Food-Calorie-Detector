// NutriScan AI Frontend Application Logic

// Configuration
const API_BASE = (window.location.protocol === 'file:' || !window.location.hostname || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:8000' 
    : window.location.origin;

// State management
let currentUser = null;
let currentView = 'dashboard';
let activeStream = null;
let activePrediction = null; // Holds the currently processed prediction FoodHistory record

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Check if token exists in storage to auto-login
    const token = localStorage.getItem('access_token');
    if (token) {
        verifySession();
    } else {
        showView('auth-view');
    }
});

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
        <span>${message}</span>
    `;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Global Router / Navigation
function navigateTo(pageId) {
    // Stop camera stream if moving away from dashboard
    if (pageId !== 'dashboard') {
        closeCameraStream();
    }
    
    // Switch active nav items in sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.classList.remove('active');
        // Simple mapping based on function call
        if (btn.getAttribute('onclick').includes(pageId)) {
            btn.classList.add('active');
        }
    });

    // Switch active page contents
    document.querySelectorAll('.app-page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentView = pageId;
        
        // Trigger specific page data loaders
        if (pageId === 'dashboard') {
            loadDashboardData();
        } else if (pageId === 'history') {
            loadHistoryPage();
        } else if (pageId === 'reports') {
            loadReportsPage();
        } else if (pageId === 'profile') {
            loadProfilePage();
        } else if (pageId === 'admin') {
            loadAdminDashboard();
        }
    }
}

function showView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

// Authentication Headers helper
function getAuthHeaders(isMultipart = false) {
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isMultipart) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// Verify existing JWT token with backend
async function verifySession() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            currentUser = await response.json();
            updateUserBadge();
            showView('main-view');
            if (currentUser.is_admin) {
                navigateTo('admin');
            } else {
                navigateTo('dashboard');
            }
        } else {
            // Token invalid or expired
            localStorage.removeItem('access_token');
            showView('auth-view');
            showToast('Session expired. Please log in again.', 'error');
        }
    } catch (err) {
        console.error('Session verification failed:', err);
        // Fallback or offline check
        localStorage.removeItem('access_token');
        showView('auth-view');
    }
}

// User Profile Badge Updates
function updateUserBadge() {
    if (currentUser) {
        document.getElementById('nav-username').textContent = currentUser.username;
        document.getElementById('nav-target-badge').textContent = `Goal: ${currentUser.daily_calorie_target} kcal`;
        
        const dashBtn = document.getElementById('nav-item-dashboard');
        const histBtn = document.getElementById('nav-item-history');
        const repBtn = document.getElementById('nav-item-reports');
        const adminBtn = document.getElementById('nav-item-admin');
        
        if (currentUser.is_admin) {
            if (dashBtn) dashBtn.classList.add('hidden');
            if (histBtn) histBtn.classList.add('hidden');
            if (repBtn) repBtn.classList.add('hidden');
            if (adminBtn) adminBtn.classList.remove('hidden');
        } else {
            if (dashBtn) dashBtn.classList.remove('hidden');
            if (histBtn) histBtn.classList.remove('hidden');
            if (repBtn) repBtn.classList.remove('hidden');
            if (adminBtn) adminBtn.classList.add('hidden');
        }
    }
}

// Auth Tabs controller (Switch Login / Register)
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById('auth-error-msg').classList.add('hidden');
    
    if (tab === 'login') {
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.getElementById('tab-register-btn').classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

// Authentication Actions
async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('login-username').value;
    const passwordInput = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('auth-error-msg');
    errorMsg.classList.add('hidden');

    try {
        // Standard OAuth2 form request structure
        const formData = new URLSearchParams();
        formData.append('username', usernameInput);
        formData.append('password', passwordInput);

        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('access_token', data.access_token);
            showToast('Logged in successfully!', 'success');
            verifySession();
        } else {
            errorMsg.textContent = data.detail || 'Login failed. Incorrect credentials.';
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        errorMsg.textContent = 'Server connection error. Please try again.';
        errorMsg.classList.remove('hidden');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const errorMsg = document.getElementById('auth-error-msg');
    errorMsg.classList.add('hidden');

    if (password !== confirm) {
        errorMsg.textContent = 'Passwords do not match.';
        errorMsg.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Registration successful! Logging in...', 'success');
            // Log user in automatically by calling login endpoints
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            const loginData = await loginRes.json();
            if (loginRes.ok) {
                localStorage.setItem('access_token', loginData.access_token);
                verifySession();
            } else {
                switchAuthTab('login');
            }
        } else {
            errorMsg.textContent = data.detail || 'Registration failed.';
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        errorMsg.textContent = 'Server connection error. Please try again.';
        errorMsg.classList.remove('hidden');
    }
}

function handleLogout() {
    closeCameraStream();
    localStorage.removeItem('access_token');
    currentUser = null;
    activePrediction = null;
    showView('auth-view');
    showToast('Signed out successfully.', 'info');
}

// ----------------------------------------------------
// DASHBOARD LOGIC
// ----------------------------------------------------

// Set Dash Offset for Calorie Ring Progress
function setCalorieRing(percent) {
    const ring = document.getElementById('calorie-progress-ring');
    const radius = ring.r.baseVal.value;
    const circumference = 2 * Math.PI * radius; // 439.82
    
    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    const cleanPercent = Math.min(Math.max(percent, 0), 100);
    const offset = circumference - (cleanPercent / 100) * circumference;
    ring.style.strokeDashoffset = offset;
}

// Load logs and update progress rings / bars
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/food/history`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const history = await response.json();
            
            // Filter logs created today (in client timezone)
            const todayStr = new Date().toDateString();
            const todayLogs = history.filter(log => {
                const logDate = new Date(log.created_at);
                return logDate.toDateString() === todayStr;
            });
            
            // Aggregate calorie sums
            let totalCals = 0;
            let totalProt = 0;
            let totalCarbs = 0;
            let totalFat = 0;
            let totalFiber = 0;
            
            todayLogs.forEach(log => {
                totalCals += log.total_calories;
                totalProt += log.total_protein;
                totalCarbs += log.total_carbs;
                totalFat += log.total_fat;
                totalFiber += log.total_fiber;
            });
            
            // Update Text Nodes
            const targetCals = currentUser.daily_calorie_target;
            document.getElementById('dash-consumed-calories').textContent = Math.round(totalCals);
            document.getElementById('dash-target-calories').textContent = targetCals;
            
            const remaining = targetCals - totalCals;
            const remainingText = document.getElementById('dash-remaining-text');
            if (remaining >= 0) {
                remainingText.textContent = `${Math.round(remaining)} kcal remaining`;
                remainingText.className = 'calories-status-text';
            } else {
                remainingText.textContent = `${Math.round(Math.abs(remaining))} kcal over target`;
                remainingText.className = 'calories-status-text text-danger';
            }
            
            // Set Progress Circular Ring percentage
            const pct = targetCals > 0 ? (totalCals / targetCals) * 100 : 0;
            setCalorieRing(pct);
            
            // Update Dashboard Macros Progress bars using user's actual goals from profile
            const macroTargets = {
                protein: currentUser.protein_goal || 120,
                carbs:   currentUser.carbs_goal   || 250,
                fat:     currentUser.fat_goal     || 70,
                fiber:   currentUser.fiber_goal   || 30
            };
            
            document.getElementById('dash-protein').textContent = Math.round(totalProt);
            document.getElementById('dash-protein-bar').style.width = `${Math.min((totalProt / macroTargets.protein) * 100, 100)}%`;
            
            document.getElementById('dash-carbs').textContent = Math.round(totalCarbs);
            document.getElementById('dash-carbs-bar').style.width = `${Math.min((totalCarbs / macroTargets.carbs) * 100, 100)}%`;
            
            document.getElementById('dash-fat').textContent = Math.round(totalFat);
            document.getElementById('dash-fat-bar').style.width = `${Math.min((totalFat / macroTargets.fat) * 100, 100)}%`;
            
            document.getElementById('dash-fiber').textContent = Math.round(totalFiber);
            document.getElementById('dash-fiber-bar').style.width = `${Math.min((totalFiber / macroTargets.fiber) * 100, 100)}%`;
        }
    } catch (err) {
        console.error('Failed to load dashboard calorie summaries:', err);
    }
}

// ----------------------------------------------------
// CAMERA & PHOTO UPLOAD FLOWS
// ----------------------------------------------------

// Image File selection
function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        uploadAndPredictImage(file);
    }
}

// Open HTML5 Web Camera Stream
async function openCameraStream() {
    closeCameraStream(); // Ensure clean start
    const container = document.getElementById('camera-stream-container');
    const video = document.getElementById('camera-video');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, // Prefer back camera
            audio: false
        });
        
        activeStream = stream;
        video.srcObject = stream;
        container.classList.remove('hidden');
        showToast('Webcam stream started', 'info');
        
        // Scroll down to the camera element
        container.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Webcam stream activation failed:', err);
        showToast('Could not access camera. Please upload an image instead.', 'error');
    }
}

function closeCameraStream() {
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
    document.getElementById('camera-stream-container').classList.add('hidden');
}

// Take picture and trigger prediction
function takeCameraSnapshot() {
    if (!activeStream) return;
    
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-snapshot-canvas');
    const context = canvas.getContext('2d');
    
    // Scale canvas to match source frame size
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Draw the active frame into canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Stop the video stream
    closeCameraStream();
    
    // Extract canvas as image blob
    canvas.toBlob((blob) => {
        if (blob) {
            // Give file name for identification in fallbacks
            const file = new File([blob], "camera_snapshot.jpg", { type: "image/jpeg" });
            uploadAndPredictImage(file);
        }
    }, 'image/jpeg');
}

// Upload file to Backend Prediction API
async function uploadAndPredictImage(imageFile) {
    showToast('Analyzing image with YOLOv8 & MobileNetV2...', 'info');
    
    // Build multipart body
    const formData = new FormData();
    formData.append('file', imageFile);
    
    try {
        const response = await fetch(`${API_BASE}/api/food/predict`, {
            method: 'POST',
            headers: getAuthHeaders(true), // Skip content-type header for multipart boundary
            body: formData
        });
        
        if (response.ok) {
            activePrediction = await response.json();
            showToast('Food elements classified successfully!', 'success');
            renderPredictionResults();
        } else {
            const data = await response.json();
            showToast(data.detail || 'Prediction failed. Check file format.', 'error');
        }
    } catch (err) {
        console.error('Image prediction call failed:', err);
        showToast('Server inference timeout. Check backend logs.', 'error');
    }
}

// Render bounding box overlays and sliders
function renderPredictionResults() {
    if (!activePrediction) return;
    
    const panel = document.getElementById('prediction-panel');
    const previewImg = document.getElementById('prediction-preview-image');
    
    // Set Preview source (combining backend url if relative)
    previewImg.src = activePrediction.image_path.startsWith('/') 
        ? `${API_BASE}${activePrediction.image_path}` 
        : activePrediction.image_path;
        
    panel.classList.remove('hidden');
    
    // Wait for image container to render to overlay accurate coords
    previewImg.onload = () => {
        renderDetectionsOverlay();
    };
    
    // Render Sliders
    renderPortionSliders();
    
    // Scroll results panel into view
    panel.scrollIntoView({ behavior: 'smooth' });
}

// Draws bounding boxes relative to displayed image container dims
function renderDetectionsOverlay() {
    const container = document.getElementById('detection-bounding-container');
    const previewImg = document.getElementById('prediction-preview-image');
    
    // Clear out old boxes (keep image element)
    document.querySelectorAll('.bounding-box').forEach(box => box.remove());
    
    if (!activePrediction || !activePrediction.items) return;
    
    // Get actual rendered pixel height and width of preview element
    const displayedWidth = previewImg.clientWidth;
    const displayedHeight = previewImg.clientHeight;
    
    // For proper coordinate mapping, determine if image padding exists
    // (since image is Centered inside the parent flex box)
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const leftOffset = (containerWidth - displayedWidth) / 2;
    const topOffset = (containerHeight - displayedHeight) / 2;

    activePrediction.items.forEach((item, index) => {
        // Build box overlay
        const box = document.createElement('div');
        box.className = 'bounding-box';
        
        // Convert normalized coordinates back to actual pixel layout
        const xmin = item.xmin * displayedWidth + leftOffset;
        const ymin = item.ymin * displayedHeight + topOffset;
        const width = (item.xmax - item.xmin) * displayedWidth;
        const height = (item.ymax - item.ymin) * displayedHeight;
        
        box.style.left = `${xmin}px`;
        box.style.top = `${ymin}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        
        // Apply color based on items indexes (cycled)
        const hue = (index * 75) % 360;
        box.style.borderColor = `hsl(${hue}, 85%, 60%)`;
        box.style.backgroundColor = `rgba(${hue}, 85%, 60%, 0.15)`;
        box.style.boxShadow = `0 0 8px hsl(${hue}, 85%, 60%)`;
        
        // Add name text badge
        const label = document.createElement('span');
        label.className = 'bounding-box-label';
        label.style.backgroundColor = `hsl(${hue}, 85%, 60%)`;
        label.textContent = `${item.name} (${Math.round(item.confidence * 100)}%)`;
        box.appendChild(label);
        
        container.appendChild(box);
    });
}

// Window resize listener to recalculate boxes automatically
window.addEventListener('resize', () => {
    if (activePrediction && !document.getElementById('prediction-panel').classList.contains('hidden')) {
        renderDetectionsOverlay();
    }
});

// Render slider lists
function renderPortionSliders() {
    const list = document.getElementById('prediction-items-list');
    list.innerHTML = '';
    
    if (!activePrediction || !activePrediction.items) return;
    
    activePrediction.items.forEach((item, index) => {
        // Store original base macro values on the item object directly
        // so we can compute scaled portion size multiplier dynamically
        if (!item.base_calories) {
            item.base_calories = item.calories / item.quantity;
            item.base_protein = item.protein / item.quantity;
            item.base_carbs = item.carbs / item.quantity;
            item.base_fat = item.fat / item.quantity;
            item.base_fiber = item.fiber / item.quantity;
        }

        const card = document.createElement('div');
        card.className = 'predict-item-card';
        
        const hue = (index * 75) % 360;
        card.style.borderLeft = `4px solid hsl(${hue}, 85%, 60%)`;
        
        card.innerHTML = `
            <div class="predict-item-header">
                <input type="text" class="predict-item-name-input" value="${item.name}" 
                    onchange="updateCalibratedName(${index}, this.value)" placeholder="Edit food name...">
                <span class="predict-item-conf">Conf: ${Math.round(item.confidence * 100)}%</span>
            </div>
            <div class="slider-group">
                <input type="range" min="0.1" max="5.0" step="0.1" value="${item.quantity}" 
                    oninput="updateCalibratedPortion(${index}, this.value)">
                <span id="slider-val-${index}" class="slider-value">${item.quantity.toFixed(1)}x</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">
                Serving: <span id="serving-lbl-${index}">${item.serving_size}</span> | 
                <span id="calories-lbl-${index}">${Math.round(item.calories)}</span> kcal
            </div>
        `;
        list.appendChild(card);
    });
    
    recalculatePredictionTotals();
}

// Adjust quantity slider values
function updateCalibratedPortion(index, qtyStr) {
    const qty = parseFloat(qtyStr);
    const item = activePrediction.items[index];
    
    // Scale macro values
    item.quantity = qty;
    item.calories = item.base_calories * qty;
    item.protein = item.base_protein * qty;
    item.carbs = item.base_carbs * qty;
    item.fat = item.base_fat * qty;
    item.fiber = item.base_fiber * qty;
    
    // Update labels
    document.getElementById(`slider-val-${index}`).textContent = `${qty.toFixed(1)}x`;
    document.getElementById(`calories-lbl-${index}`).textContent = Math.round(item.calories);
    
    // Adjust serving badge description if standard multiplier matches
    const baseServingVal = parseInt(item.serving_size) || 100;
    const finalGrams = Math.round(baseServingVal * qty);
    document.getElementById(`serving-lbl-${index}`).textContent = `${finalGrams}g`;
    
    recalculatePredictionTotals();
}

// Update food name and re-fetch nutrition values in real-time
async function updateCalibratedName(index, newName) {
    const item = activePrediction.items[index];
    if (!newName || !newName.trim()) {
        showToast("Food name cannot be empty.", "error");
        return;
    }
    
    const cleanName = newName.trim();
    item.name = cleanName;
    
    try {
        const response = await fetch(`${API_BASE}/api/food/nutrition-lookup?food_name=${encodeURIComponent(cleanName)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update base nutritional parameters on the object
            item.base_calories = data.calories;
            item.base_protein = data.protein;
            item.base_carbs = data.carbs;
            item.base_fat = data.fat;
            item.base_fiber = data.fiber;
            item.serving_size = data.serving_size;
            
            // Recalculate current scaled values
            const qty = item.quantity;
            item.calories = item.base_calories * qty;
            item.protein = item.base_protein * qty;
            item.carbs = item.base_carbs * qty;
            item.fat = item.base_fat * qty;
            item.fiber = item.base_fiber * qty;
            
            // Refresh display elements for this item
            document.getElementById(`calories-lbl-${index}`).textContent = Math.round(item.calories);
            document.getElementById(`serving-lbl-${index}`).textContent = `${Math.round(parseFloat(item.serving_size) * qty)}g`;
            
            recalculatePredictionTotals();
            showToast(`Updated to "${cleanName}" & retrieved nutrition facts!`, 'success');
        } else {
            showToast("Failed to fetch nutrition data for this food.", "error");
        }
    } catch (err) {
        console.error("Error fetching renamed food nutrition:", err);
        showToast("Server connection error loading food data.", "error");
    }
}

// Sum all components nutrition
function recalculatePredictionTotals() {
    if (!activePrediction || !activePrediction.items) return;
    
    let totalCals = 0;
    let totalProt = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    
    activePrediction.items.forEach(item => {
        totalCals += item.calories;
        totalProt += item.protein;
        totalCarbs += item.carbs;
        totalFat += item.fat;
        totalFiber += item.fiber;
    });
    
    document.getElementById('pred-total-calories').textContent = Math.round(totalCals);
    document.getElementById('pred-total-protein').textContent = Math.round(totalProt);
    document.getElementById('pred-total-carbs').textContent = Math.round(totalCarbs);
    document.getElementById('pred-total-fat').textContent = Math.round(totalFat);
    document.getElementById('pred-total-fiber').textContent = Math.round(totalFiber);
}

// Save calibrated predictions to the log in backend DB
async function savePredictionToLog() {
    if (!activePrediction || !activePrediction.items) return;
    
    const saveBtn = document.getElementById('save-prediction-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        // We PUT updates for each item quantity and name to the database
        const updatePromises = activePrediction.items.map(item => {
            return fetch(`${API_BASE}/api/food/item/${item.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ quantity: item.quantity, name: item.name })
            });
        });
        
        await Promise.all(updatePromises);
        
        showToast('Meal logged successfully!', 'success');
        
        // Hide calibration panel
        document.getElementById('prediction-panel').classList.add('hidden');
        activePrediction = null;
        
        // Refresh dashboard numbers and progress circle
        loadDashboardData();
        
    } catch (err) {
        console.error('Failed to save portions sizes:', err);
        showToast('Could not save portion scales.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save to Daily Log';
    }
}

// Discards current prediction and deletes it from database
async function discardPrediction() {
    if (!activePrediction) return;
    
    if (confirm('Are you sure you want to discard this photo and cancel logging?')) {
        try {
            const response = await fetch(`${API_BASE}/api/food/history/${activePrediction.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                showToast('Prediction log discarded.', 'info');
                document.getElementById('prediction-panel').classList.add('hidden');
                activePrediction = null;
            } else {
                showToast('Failed to discard log from server.', 'error');
            }
        } catch (err) {
            console.error('Discard call failed:', err);
            showToast('Connection error discarding log.', 'error');
        }
    }
}

// ----------------------------------------------------
// HISTORY PAGE LOGIC
// ----------------------------------------------------

async function loadHistoryPage() {
    const listContainer = document.getElementById('history-container');
    const loadingSpinner = document.getElementById('history-loading-spinner');
    const emptyState = document.getElementById('history-empty');
    
    listContainer.innerHTML = '';
    loadingSpinner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/food/history`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        loadingSpinner.classList.add('hidden');
        
        if (response.ok) {
            const history = await response.json();
            
            if (history.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }
            
            history.forEach(log => {
                const card = document.createElement('div');
                card.className = 'history-card';
                card.id = `history-card-${log.id}`;
                
                // Parse date
                const date = new Date(log.created_at);
                const formattedTime = date.toLocaleDateString(undefined, { 
                    weekday: 'short', month: 'short', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                
                // Map item tags
                const tagsHtml = log.items.map(it => {
                    return `<span class="item-tag">${it.name} (${it.quantity.toFixed(1)}x)</span>`;
                }).join('');
                
                const imgSrc = log.image_path 
                    ? (log.image_path.startsWith('/') ? `${API_BASE}${log.image_path}` : log.image_path)
                    : 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&auto=format&fit=crop&q=60';
                    
                card.innerHTML = `
                    <div class="history-card-image">
                        <img src="${imgSrc}" alt="Meal Photo" onerror="this.src='https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&auto=format&fit=crop&q=60'">
                    </div>
                    <div class="history-card-details">
                        <div class="history-card-header">
                            <span class="history-card-time"><i class="fa-solid fa-calendar-day"></i> ${formattedTime}</span>
                            <button class="history-card-delete-btn" onclick="handleDeleteHistory(${log.id})">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <div class="history-card-items-badges">
                            ${tagsHtml}
                        </div>
                        <div class="history-card-macros">
                            <div class="history-macro-cell" style="border-right: 1px solid rgba(255,255,255,0.05)">
                                <span class="label">Calories</span>
                                <span class="val accent-text">${Math.round(log.total_calories)}</span>
                            </div>
                            <div class="history-macro-cell" style="border-right: 1px solid rgba(255,255,255,0.05)">
                                <span class="label">Prot</span>
                                <span class="val protein-text">${Math.round(log.total_protein)}g</span>
                            </div>
                            <div class="history-macro-cell" style="border-right: 1px solid rgba(255,255,255,0.05)">
                                <span class="label">Carbs</span>
                                <span class="val carbs-text">${Math.round(log.total_carbs)}g</span>
                            </div>
                            <div class="history-macro-cell" style="border-right: 1px solid rgba(255,255,255,0.05)">
                                <span class="label">Fat</span>
                                <span class="val fat-text">${Math.round(log.total_fat)}g</span>
                            </div>
                            <div class="history-macro-cell">
                                <span class="label">Fiber</span>
                                <span class="val fiber-text">${Math.round(log.total_fiber)}g</span>
                            </div>
                        </div>
                    </div>
                `;
                listContainer.appendChild(card);
            });
        } else {
            showToast('Failed to load meal logs.', 'error');
        }
    } catch (err) {
        loadingSpinner.classList.add('hidden');
        console.error('Failed to fetch history logs:', err);
        showToast('Connection error displaying logs.', 'error');
    }
}

// Delete Log Entry
async function handleDeleteHistory(historyId) {
    if (confirm('Delete this food log permanently? This will remove all calculated metrics for this meal.')) {
        try {
            const response = await fetch(`${API_BASE}/api/food/history/${historyId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                showToast('Log entry removed successfully!', 'success');
                
                // Fade card out from DOM
                const card = document.getElementById(`history-card-${historyId}`);
                if (card) {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        card.remove();
                        // If all removed, show empty state
                        if (document.querySelectorAll('.history-card').length === 0) {
                            document.getElementById('history-empty').classList.remove('hidden');
                        }
                    }, 300);
                }
            } else {
                showToast('Failed to delete history log.', 'error');
            }
        } catch (err) {
            console.error('Delete call failed:', err);
            showToast('Connection error removing log.', 'error');
        }
    }
}

// ----------------------------------------------------
// REPORTS PAGE LOGIC
// ----------------------------------------------------

async function loadReportsPage() {
    try {
        const response = await fetch(`${API_BASE}/api/reports/weekly`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Set Metrics averages
            document.getElementById('weekly-avg-calories').textContent = Math.round(data.average_calories);
            document.getElementById('weekly-avg-protein').textContent = Math.round(data.weekly_macros.protein);
            document.getElementById('weekly-avg-carbs').textContent = Math.round(data.weekly_macros.carbs);
            document.getElementById('weekly-avg-fat').textContent = Math.round(data.weekly_macros.fat);
            document.getElementById('weekly-avg-fiber').textContent = Math.round(data.weekly_macros.fiber);
            
            // Draw Chart
            drawWeeklyChart(data.daily_summaries);
        }
    } catch (err) {
        console.error('Failed to load weekly reports:', err);
    }
}

// Renders inline SVG bar charts representing calorie logs vs targets
function drawWeeklyChart(dailySummaries) {
    const svg = document.getElementById('weekly-chart');
    svg.innerHTML = ''; // Clear old chart
    
    // Add Gradients definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.3" />
        </linearGradient>
    `;
    svg.appendChild(defs);
    
    const width = 700;
    const height = 300;
    const padding = { top: 30, right: 30, bottom: 40, left: 55 };
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Find Max Calorie to scale y axis properly
    const maxVal = Math.max(...dailySummaries.map(d => d.calories), currentUser.daily_calorie_target, 2500);
    const yScale = (val) => chartHeight - (val / maxVal) * chartHeight + padding.top;
    
    // Draw Grid Lines (horizontal)
    const gridDivisions = 4;
    for (let i = 0; i <= gridDivisions; i++) {
        const val = (maxVal / gridDivisions) * i;
        const y = yScale(val);
        
        // Draw grid lines
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padding.left);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - padding.right);
        line.setAttribute('y2', y);
        line.className.baseVal = 'chart-grid';
        svg.appendChild(line);
        
        // Y Axis Labels
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', padding.left - 10);
        text.setAttribute('y', y + 4);
        text.setAttribute('text-anchor', 'end');
        text.className.baseVal = 'chart-label';
        text.textContent = `${Math.round(val)}`;
        svg.appendChild(text);
    }
    
    // Draw Daily Columns
    const barWidth = 42;
    const gap = (chartWidth - barWidth * 7) / 6;
    
    dailySummaries.forEach((d, i) => {
        const x = padding.left + i * (barWidth + gap);
        const y = yScale(d.calories);
        const barHeight = chartHeight - (y - padding.top);
        
        // Bar Column
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barWidth);
        rect.setAttribute('height', Math.max(barHeight, 0));
        rect.className.baseVal = 'chart-bar';
        svg.appendChild(rect);
        
        // Value Text Overlay (on top of bars)
        if (d.calories > 0) {
            const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valText.setAttribute('x', x + barWidth / 2);
            valText.setAttribute('y', y - 8);
            valText.setAttribute('text-anchor', 'middle');
            valText.style.fill = 'var(--text-primary)';
            valText.style.fontWeight = '600';
            valText.style.fontSize = '10px';
            valText.textContent = `${Math.round(d.calories)}`;
            svg.appendChild(valText);
        }
        
        // X Axis Dates (formatted Day Name, e.g. Mon)
        const dateObj = new Date(d.date);
        const dayStr = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', x + barWidth / 2);
        labelText.setAttribute('y', height - padding.bottom + 22);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.className.baseVal = 'chart-label';
        labelText.textContent = dayStr;
        svg.appendChild(labelText);
    });
    
    // Draw Daily Goal line (dotted red indicator)
    const targetY = yScale(currentUser.daily_calorie_target);
    const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    targetLine.setAttribute('x1', padding.left);
    targetLine.setAttribute('y1', targetY);
    targetLine.setAttribute('x2', width - padding.right);
    targetLine.setAttribute('y2', targetY);
    targetLine.className.baseVal = 'chart-target-line';
    svg.appendChild(targetLine);
    
    // Label for target line
    const targetLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    targetLabel.setAttribute('x', width - padding.right);
    targetLabel.setAttribute('y', targetY - 6);
    targetLabel.setAttribute('text-anchor', 'end');
    targetLabel.style.fill = 'var(--danger)';
    targetLabel.style.fontSize = '10px';
    targetLabel.style.fontWeight = '600';
    targetLabel.textContent = `Goal: ${currentUser.daily_calorie_target} kcal`;
    svg.appendChild(targetLabel);
}

// Download weekly reports pdf using standard authorized blobs fetch
async function downloadPDFReport() {
    showToast('Preparing PDF download report...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/api/reports/pdf`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `weekly_nutrition_report_${currentUser.username}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            showToast('PDF Report downloaded successfully!', 'success');
        } else {
            showToast('Failed to generate PDF Report.', 'error');
        }
    } catch (err) {
        console.error('PDF report retrieval failed:', err);
        showToast('Connection error downloading report.', 'error');
    }
}

// ====================================================
// PROFILE DASHBOARD – Full Implementation
// ====================================================

// ── Unit preference state ──────────────────────────
let profileUnits = 'metric'; // 'metric' | 'imperial'
let selectedActivity = 'sedentary';

// ── Main loader ────────────────────────────────────
async function loadProfilePage() {
    if (!currentUser) return;

    // Fetch fresh profile from backend
    try {
        const res = await fetch(`${API_BASE}/api/users/profile`, { headers: getAuthHeaders() });
        if (res.ok) {
            currentUser = await res.json();
            updateUserBadge();
        }
    } catch (e) { /* use cached currentUser */ }

    populateProfileHero();
    populateMeasurementsForm();
    populateNutritionGoals();
    populateHealthSummary();
    populateSettings();

    if (currentUser.bmi) {
        renderBMIDisplay(currentUser.bmi, currentUser.bmi_category);
        generateAIInsights(currentUser);
        renderWeightChart();
        renderBMITrendChart();
    }
}

// ── 1. Profile Hero ────────────────────────────────
function populateProfileHero() {
    const u = currentUser;
    document.getElementById('phero-name').textContent = u.username || '—';
    document.getElementById('phero-email').innerHTML =
        `<i class="fa-solid fa-envelope"></i> ${u.email || '—'}`;

    const ageTxt = u.age ? `${u.age} yrs` : 'Age not set';
    const genderTxt = u.gender ? capitalize(u.gender) : 'Not set';
    const joinedTxt = u.created_at
        ? new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        : '—';

    document.getElementById('phero-age').textContent = ageTxt;
    document.getElementById('phero-gender').textContent = genderTxt;
    document.getElementById('phero-joined').textContent = joinedTxt;
}

// ── 2. Measurements Form ───────────────────────────
function populateMeasurementsForm() {
    const u = currentUser;
    profileUnits = u.units_preference || 'metric';
    selectedActivity = u.activity_level || 'sedentary';

    // Set unit labels
    applyUnitLabels();

    // Populate fields (convert if imperial)
    document.getElementById('m-height').value = u.height_cm
        ? (profileUnits === 'imperial' ? cmToFt(u.height_cm).toFixed(1) : u.height_cm)
        : '';
    document.getElementById('m-weight').value = u.weight_kg
        ? (profileUnits === 'imperial' ? kgToLbs(u.weight_kg).toFixed(1) : u.weight_kg)
        : '';
    document.getElementById('m-age').value = u.age || '';
    document.getElementById('m-gender').value = u.gender || '';
    document.getElementById('m-target-weight').value = u.target_weight
        ? (profileUnits === 'imperial' ? kgToLbs(u.target_weight).toFixed(1) : u.target_weight)
        : '';

    // Activity pills
    document.querySelectorAll('.activity-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.value === selectedActivity);
    });

    // Live BMI from form values
    onMeasurementInput();
}

function applyUnitLabels() {
    const heightLbl = profileUnits === 'imperial' ? 'ft' : 'cm';
    const weightLbl = profileUnits === 'imperial' ? 'lbs' : 'kg';
    document.getElementById('height-unit-label').textContent = heightLbl;
    document.getElementById('weight-unit-label').textContent = weightLbl;
    document.getElementById('target-weight-unit-label').textContent = weightLbl;

    // Update input min/max for unit
    const hInput = document.getElementById('m-height');
    const wInput = document.getElementById('m-weight');
    if (profileUnits === 'imperial') {
        hInput.min = 1.6; hInput.max = 9; hInput.placeholder = 'e.g. 5.8';
        wInput.min = 22; wInput.max = 880; wInput.placeholder = 'e.g. 155';
        document.getElementById('err-height').textContent = 'Height must be 1.6–9 ft';
        document.getElementById('err-weight').textContent = 'Weight must be 22–880 lbs';
    } else {
        hInput.min = 50; hInput.max = 280; hInput.placeholder = 'e.g. 175';
        wInput.min = 10; wInput.max = 400; wInput.placeholder = 'e.g. 70';
        document.getElementById('err-height').textContent = 'Height must be 50–280 cm';
        document.getElementById('err-weight').textContent = 'Weight must be 10–400 kg';
    }
}

function selectActivity(btn) {
    document.querySelectorAll('.activity-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    selectedActivity = btn.dataset.value;
    onMeasurementInput();
}

// ── 3. Live BMI on input ───────────────────────────
function onMeasurementInput() {
    const rawH = parseFloat(document.getElementById('m-height').value);
    const rawW = parseFloat(document.getElementById('m-weight').value);

    if (!rawH || !rawW) return;

    // Convert to metric for calculation
    const heightCm = profileUnits === 'imperial' ? ftToCm(rawH) : rawH;
    const weightKg = profileUnits === 'imperial' ? lbsToKg(rawW) : rawW;

    const bmi = calcBMI(weightKg, heightCm);
    const category = bmiCategory(bmi);

    renderBMIDisplay(bmi, category);

    // Also recalculate nutrition goals live
    const age = parseInt(document.getElementById('m-age').value) || currentUser.age;
    const gender = document.getElementById('m-gender').value || currentUser.gender;
    if (age && gender) {
        const goals = calcNutritionGoals(weightKg, heightCm, age, gender, selectedActivity);
        renderNutritionGoals(goals);
    }
}

// ── BMI Math ───────────────────────────────────────
function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0) return null;
    return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

function bmiCategory(bmi) {
    if (!bmi) return null;
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25.0) return 'normal';
    if (bmi < 30.0) return 'overweight';
    return 'obese';
}

function bmiColor(category) {
    return { underweight: '#3b82f6', normal: '#10b981', overweight: '#f59e0b', obese: '#ef4444' }[category] || '#94a3b8';
}

// ── BMI Visual Renderer ────────────────────────────
function renderBMIDisplay(bmi, category) {
    if (!bmi) return;
    const color = bmiColor(category);
    const scoreEl = document.getElementById('bmi-score');
    const labelEl = document.getElementById('bmi-category-label');

    scoreEl.textContent = bmi;
    scoreEl.style.background = color;
    scoreEl.style.webkitBackgroundClip = 'text';
    scoreEl.style.webkitTextFillColor = 'transparent';
    labelEl.textContent = category ? capitalize(category) : '—';
    labelEl.style.color = color;

    // Progress bar needle (BMI 10–40 range mapped 0–100%)
    const pct = Math.min(Math.max(((bmi - 10) / 30) * 100, 0), 100);
    const needle = document.getElementById('bmi-needle');
    if (needle) { needle.style.left = `${pct}%`; needle.style.color = color; }

    // SVG Gauge arc
    updateBMIGaugeArc(bmi, color);

    // Recommendation text
    renderBMIRecommendation(category);
}

function updateBMIGaugeArc(bmi, color) {
    // Semicircle arc from M20,100 to M180,100 through top
    // BMI range 10–40 maps to angle 180°–0° (left to right)
    const clampedBMI = Math.min(Math.max(bmi, 10), 40);
    const fraction = (clampedBMI - 10) / 30; // 0 to 1
    const angleDeg = 180 - fraction * 180;    // 180° at left, 0° at right
    const angleRad = (angleDeg * Math.PI) / 180;

    const cx = 100, cy = 100, r = 80;
    const x = Math.round((cx + r * Math.cos(Math.PI - angleRad)) * 100) / 100;
    const y = Math.round((cy - r * Math.sin(Math.PI - angleRad)) * 100) / 100;

    // Large arc flag: 1 if bmi < 20 (more than 180° remaining)
    const largeArc = fraction < 0.5 ? 1 : 0;
    const arcPath = `M20,100 A80,80 0 ${largeArc},1 ${x},${y}`;

    const arcEl = document.getElementById('bmi-gauge-arc');
    const dotEl = document.getElementById('bmi-gauge-dot');
    if (arcEl) { arcEl.setAttribute('d', arcPath); arcEl.setAttribute('stroke', color); }
    if (dotEl) { dotEl.setAttribute('cx', x); dotEl.setAttribute('cy', y); dotEl.setAttribute('fill', color); }
}

function renderBMIRecommendation(category) {
    const box = document.getElementById('bmi-recommendation');
    if (!box) return;

    const recs = {
        underweight: {
            icon: 'fa-arrow-up', cls: 'bmi-rec-underweight',
            text: '💡 Your BMI suggests you may be underweight. Focus on nutrient-dense foods, healthy fats (nuts, avocado), and lean proteins. Aim to gain 0.25–0.5 kg/week. Consult a dietitian for a personalized plan.'
        },
        normal: {
            icon: 'fa-circle-check', cls: 'bmi-rec-normal',
            text: '✅ Your BMI is in the healthy range — great work! Maintain your weight with a balanced diet, regular physical activity, and 7–9 hours of sleep. Stay hydrated and keep logging your meals!'
        },
        overweight: {
            icon: 'fa-triangle-exclamation', cls: 'bmi-rec-overweight',
            text: '⚠️ Your BMI is slightly above the healthy range. Reduce processed foods and added sugars, increase fiber intake, and aim for 150 min/week of moderate exercise. A 500 kcal daily deficit helps lose ~0.5 kg/week.'
        },
        obese: {
            icon: 'fa-circle-exclamation', cls: 'bmi-rec-obese',
            text: '🚨 Your BMI indicates obesity, which increases health risks. Please consult a healthcare professional. Focus on whole foods, portion control, and gradual activity increase. Even a 5–10% weight loss significantly improves health.'
        }
    };

    const rec = recs[category];
    if (!rec) return;
    box.className = `bmi-recommendation-box ${rec.cls}`;
    box.innerHTML = `<i class="fa-solid ${rec.icon}"></i><span>${rec.text}</span>`;
}

// ── Nutrition Goals Calculation ────────────────────
function calcNutritionGoals(weightKg, heightCm, age, gender, activityLevel) {
    if (!weightKg || !heightCm || !age || !gender) return null;
    const bmr = gender.toLowerCase() === 'female'
        ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
        : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

    const multipliers = {
        sedentary: 1.2, lightly_active: 1.375,
        moderately_active: 1.55, very_active: 1.725, athlete: 1.9
    };
    const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.2));
    return {
        calories: tdee,
        protein: Math.round(weightKg * 1.6 * 10) / 10,
        carbs: Math.round((tdee * 0.45) / 4 * 10) / 10,
        fat: Math.round((tdee * 0.25) / 9 * 10) / 10,
        water: Math.round(weightKg * 0.033 * 100) / 100,
        fiber: gender.toLowerCase() === 'female' ? 25 : 38
    };
}

// ── 4. Nutrition Goals Display ─────────────────────
function populateNutritionGoals() {
    const u = currentUser;
    if (!u.daily_calorie_target && !u.protein_goal) return;
    renderNutritionGoals({
        calories: u.daily_calorie_target,
        protein: u.protein_goal,
        carbs: u.carbs_goal,
        fat: u.fat_goal,
        water: u.water_goal,
        fiber: u.fiber_goal
    });
}

function renderNutritionGoals(goals) {
    if (!goals) return;
    const fmt = (v, d=0) => v != null ? (d > 0 ? parseFloat(v).toFixed(d) : Math.round(v)) : '—';
    document.getElementById('ng-calories').textContent = fmt(goals.calories);
    document.getElementById('ng-protein').textContent = fmt(goals.protein, 1);
    document.getElementById('ng-carbs').textContent = fmt(goals.carbs, 1);
    document.getElementById('ng-fat').textContent = fmt(goals.fat, 1);
    document.getElementById('ng-water').textContent = fmt(goals.water, 2);
    document.getElementById('ng-fiber').textContent = fmt(goals.fiber);
}

// ── 5. Health Summary ──────────────────────────────
async function populateHealthSummary() {
    const u = currentUser;
    const wUnit = profileUnits === 'imperial' ? 'lbs' : 'kg';
    const fmt = (kg) => kg ? `${profileUnits === 'imperial' ? kgToLbs(kg).toFixed(1) : kg} ${wUnit}` : '—';

    document.getElementById('hs-current-weight').textContent = fmt(u.weight_kg);
    document.getElementById('hs-target-weight').textContent = fmt(u.target_weight);
    document.getElementById('hs-bmi').textContent = u.bmi ? `${u.bmi} (${capitalize(u.bmi_category || '')})` : '—';

    // Calories today from history
    try {
        const res = await fetch(`${API_BASE}/api/food/history`, { headers: getAuthHeaders() });
        if (res.ok) {
            const history = await res.json();
            const todayStr = new Date().toDateString();
            const todayLogs = history.filter(l => new Date(l.created_at).toDateString() === todayStr);
            const consumed = todayLogs.reduce((s, l) => s + l.total_calories, 0);
            const target = u.daily_calorie_target || 2000;
            const remaining = Math.max(target - consumed, 0);

            document.getElementById('hs-calories-remaining').textContent = `${Math.round(remaining)} kcal`;
            document.getElementById('hs-meals-logged').textContent = todayLogs.length;
            document.getElementById('hs-ai-detections').textContent = todayLogs.length;
        }
    } catch (e) {
        document.getElementById('hs-calories-remaining').textContent = '—';
    }

    // Weight-to-goal progress bar
    renderWeightProgress();
}

function renderWeightProgress() {
    const u = currentUser;
    if (!u.weight_kg || !u.target_weight) return;

    const section = document.getElementById('weight-progress-section');
    const wUnit = profileUnits === 'imperial' ? 'lbs' : 'kg';
    const cw = profileUnits === 'imperial' ? kgToLbs(u.weight_kg) : u.weight_kg;
    const tw = profileUnits === 'imperial' ? kgToLbs(u.target_weight) : u.target_weight;

    // Calculate percentage toward goal
    // If goal is to lose weight: start = higher weight, we reduce
    const totalChange = Math.abs(cw - tw);
    const pct = totalChange < 0.1 ? 100 : Math.max(0, Math.min(100,
        cw <= tw ? 100 : ((tw - cw + totalChange) / totalChange) * 100
    ));

    document.getElementById('wp-pct').textContent = `${Math.round(pct)}%`;
    document.getElementById('wp-bar').style.width = `${pct}%`;
    document.getElementById('wp-start-label').textContent = `${cw.toFixed(1)} ${wUnit}`;
    document.getElementById('wp-goal-label').textContent = `${tw.toFixed(1)} ${wUnit}`;
}

// ── 6. Progress Charts ─────────────────────────────
function renderWeightChart() {
    // Simulated 7-day weight trend (slight variation around current weight)
    const svg = document.getElementById('profile-weight-chart');
    if (!svg || !currentUser.weight_kg) return;

    const w = currentUser.weight_kg;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Today'];
    // Simulate slight weight fluctuation over 7 days
    const weights = days.map((_, i) => +(w + (Math.sin(i * 0.9) * 0.4 - 0.2 * i * 0.1)).toFixed(1));
    weights[6] = w; // Today is exact

    drawLineChart(svg, days, weights, '#10b981', `Weight (${profileUnits === 'imperial' ? 'lbs' : 'kg'})`);
}

function renderBMITrendChart() {
    const svg = document.getElementById('profile-bmi-chart');
    if (!svg || !currentUser.bmi) return;

    const bmi = currentUser.bmi;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Now'];
    // Simulate a gradual trend toward current BMI
    const startBmi = +(bmi + 1.5).toFixed(1);
    const bmis = months.map((_, i) => +(startBmi - (startBmi - bmi) * (i / 6)).toFixed(1));
    bmis[6] = bmi;

    drawLineChart(svg, months, bmis, '#3b82f6', 'BMI');
}

function drawLineChart(svg, labels, values, lineColor, yLabel) {
    svg.innerHTML = '';
    const W = 600, H = 220;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    const min = Math.min(...values) - 1;
    const max = Math.max(...values) + 1;
    const xStep = cW / (labels.length - 1);
    const yScale = v => pad.top + cH - ((v - min) / (max - min)) * cH;

    const ns = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
        return el;
    };

    // Defs: gradient fill under line
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
        <linearGradient id="lgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
        </linearGradient>`;
    svg.appendChild(defs);

    // Grid lines
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (cH / 4) * i;
        svg.appendChild(mk('line', { x1: pad.left, y1: y, x2: W - pad.right, y2: y,
            stroke: 'rgba(255,255,255,0.05)', 'stroke-width': 1, 'stroke-dasharray': '4' }));
        const val = max - ((max - min) / 4) * i;
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', pad.left - 8); t.setAttribute('y', y + 4);
        t.setAttribute('text-anchor', 'end'); t.setAttribute('fill', '#64748b');
        t.setAttribute('font-size', '10'); t.setAttribute('font-family', 'Outfit,sans-serif');
        t.textContent = val.toFixed(1);
        svg.appendChild(t);
    }

    // Area fill path
    const areaPoints = values.map((v, i) => `${pad.left + i * xStep},${yScale(v)}`).join(' L ');
    const lastX = pad.left + (values.length - 1) * xStep;
    svg.appendChild(mk('path', {
        d: `M${pad.left},${yScale(values[0])} L${areaPoints} L${lastX},${H - pad.bottom} L${pad.left},${H - pad.bottom} Z`,
        fill: 'url(#lgFill)'
    }));

    // Line
    const linePoints = values.map((v, i) => `${pad.left + i * xStep},${yScale(v)}`).join(' L ');
    svg.appendChild(mk('path', {
        d: `M${linePoints}`, fill: 'none', stroke: lineColor,
        'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));

    // Data points and X labels
    values.forEach((v, i) => {
        const x = pad.left + i * xStep;
        const y = yScale(v);
        const isLast = i === values.length - 1;

        // Dot
        svg.appendChild(mk('circle', { cx: x, cy: y, r: isLast ? 5 : 3.5, fill: lineColor,
            stroke: 'var(--bg-primary)', 'stroke-width': 2 }));

        // Value label on last point
        if (isLast) {
            const t = document.createElementNS(ns, 'text');
            t.setAttribute('x', x); t.setAttribute('y', y - 10);
            t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', lineColor);
            t.setAttribute('font-size', '11'); t.setAttribute('font-weight', '700');
            t.setAttribute('font-family', 'Outfit,sans-serif');
            t.textContent = v;
            svg.appendChild(t);
        }

        // X axis label
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', x); lbl.setAttribute('y', H - pad.bottom + 18);
        lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#64748b');
        lbl.setAttribute('font-size', '10'); lbl.setAttribute('font-family', 'Outfit,sans-serif');
        lbl.textContent = labels[i];
        svg.appendChild(lbl);
    });
}

function switchProfileChart(type, btn) {
    document.querySelectorAll('.pchart-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const wChart = document.getElementById('profile-weight-chart');
    const bChart = document.getElementById('profile-bmi-chart');
    if (type === 'weight') {
        wChart.classList.remove('hidden'); bChart.classList.add('hidden');
    } else {
        bChart.classList.remove('hidden'); wChart.classList.add('hidden');
    }
}

// ── 7. AI Health Insights ──────────────────────────
function generateAIInsights(user) {
    const container = document.getElementById('ai-insights-content');
    if (!container) return;

    const bmi = user.bmi;
    const cat = user.bmi_category;
    const age = user.age;
    const gender = user.gender;
    const activity = user.activity_level || 'sedentary';
    const cal = user.daily_calorie_target;

    // Weekly health score (simple algorithm)
    let score = 70;
    if (cat === 'normal') score += 15;
    else if (cat === 'overweight') score -= 5;
    else if (cat === 'obese') score -= 20;
    if (activity === 'very_active' || activity === 'athlete') score += 10;
    else if (activity === 'sedentary') score -= 5;
    if (age && age >= 18 && age <= 60) score += 5;
    score = Math.min(Math.max(score, 0), 100);

    const insights = [];

    // Calorie insight
    insights.push({
        icon: 'fa-fire-flame-curved', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
        title: 'Recommended Daily Calories',
        text: `Based on your profile, you need approximately ${cal ? cal.toLocaleString() : '—'} kcal/day. This accounts for your age, weight, height, and activity level using the Mifflin-St Jeor formula.`
    });

    // Food recommendations
    const foodRec = {
        underweight: { title: 'Foods to Increase', text: 'Prioritize calorie-dense foods: nut butters, whole milk, avocados, brown rice, eggs, legumes, and olive oil. Eat 5–6 smaller meals throughout the day.' },
        normal: { title: 'Foods to Maintain', text: 'Keep up with lean proteins (chicken, fish, tofu), complex carbs (oats, quinoa), healthy fats (nuts, seeds), and plenty of vegetables and fruits.' },
        overweight: { title: 'Foods to Reduce', text: 'Cut back on refined carbs, sugary drinks, and processed snacks. Increase vegetables, lean protein, and fiber-rich foods like lentils and whole grains to feel fuller longer.' },
        obese: { title: 'Dietary Priority', text: 'Focus on whole, minimally processed foods. Eliminate sugary beverages and fast food. Prioritize high-fiber vegetables and lean proteins. Consider working with a registered dietitian.' }
    };
    const fr = foodRec[cat] || foodRec.normal;
    insights.push({ icon: 'fa-utensils', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', title: fr.title, text: fr.text });

    // Exercise suggestion
    const exRec = {
        sedentary: 'Start with 20–30 min of walking 5 days/week. Gradually add strength training 2x/week to boost metabolism.',
        lightly_active: 'Great start! Aim for 150 min/week of moderate cardio + 2–3 strength sessions. Try cycling, swimming, or yoga.',
        moderately_active: 'You are doing well! Add HIIT intervals 1–2x/week and focus on progressive overload in your strength routine.',
        very_active: 'Excellent activity level! Ensure adequate recovery: 7–9h sleep, protein within 30 min post-workout, foam rolling.',
        athlete: 'Elite level activity. Periodize your training, track VO2 max, and work with a sports nutritionist for peak performance.'
    };
    insights.push({
        icon: 'fa-person-running', color: '#10b981', bg: 'rgba(16,185,129,0.12)',
        title: 'Exercise Recommendation',
        text: exRec[activity] || exRec.sedentary
    });

    // Hydration
    const water = user.water_goal || (user.weight_kg ? (user.weight_kg * 0.033).toFixed(2) : 2.5);
    insights.push({
        icon: 'fa-glass-water', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',
        title: '💧 Daily Hydration Reminder',
        text: `Drink at least ${water}L of water daily. Spread it through the day — start with a glass in the morning. Proper hydration improves metabolism, focus, and skin health.`
    });

    // Predicted trend
    const trendTxt = cat === 'normal'
        ? 'You are on track to maintain a healthy weight! Keep logging meals consistently.'
        : cat === 'overweight' || cat === 'obese'
        ? 'With a 500 kcal daily deficit, you can expect to lose ~0.5 kg/week, reaching a healthier BMI in a few months.'
        : 'With consistent calorie surplus and strength training, you can expect gradual healthy weight gain over the coming weeks.';
    insights.push({
        icon: 'fa-chart-line', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',
        title: 'Predicted Weight Trend',
        text: trendTxt
    });

    // Build HTML
    container.innerHTML = `
        <div class="ai-health-score-wrap">
            <div class="ai-score-num">${score}</div>
            <div class="ai-score-label"><strong>Weekly Health Score</strong>Based on your BMI, activity, and nutrition goals</div>
        </div>
        <div class="ai-insights-grid">
            ${insights.map(ins => `
                <div class="ai-insight-item">
                    <div class="ai-insight-icon" style="background:${ins.bg};color:${ins.color}">
                        <i class="fa-solid ${ins.icon}"></i>
                    </div>
                    <div class="ai-insight-content">
                        <div class="ai-insight-title">${ins.title}</div>
                        <div class="ai-insight-text">${ins.text}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ── 8. Settings ────────────────────────────────────
function populateSettings() {
    const u = currentUser;
    profileUnits = u.units_preference || 'metric';

    // Unit toggle
    document.querySelectorAll('.unit-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === profileUnits);
    });

    // Notification toggles
    if (document.getElementById('notif-health'))
        document.getElementById('notif-health').checked = u.notif_health !== false;
    if (document.getElementById('notif-calorie'))
        document.getElementById('notif-calorie').checked = u.notif_calorie_reminders !== false;
    if (document.getElementById('notif-weekly'))
        document.getElementById('notif-weekly').checked = u.notif_weekly_reports !== false;

    // Account email
    if (document.getElementById('settings-email'))
        document.getElementById('settings-email').value = u.email || '';
}

async function setUnits(unit, btn) {
    document.querySelectorAll('.unit-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    profileUnits = unit;
    applyUnitLabels();

    // Reconvert displayed values
    const u = currentUser;
    if (u.height_cm) document.getElementById('m-height').value =
        unit === 'imperial' ? cmToFt(u.height_cm).toFixed(1) : u.height_cm;
    if (u.weight_kg) document.getElementById('m-weight').value =
        unit === 'imperial' ? kgToLbs(u.weight_kg).toFixed(1) : u.weight_kg;
    if (u.target_weight) document.getElementById('m-target-weight').value =
        unit === 'imperial' ? kgToLbs(u.target_weight).toFixed(1) : u.target_weight;

    // Persist preference
    try {
        await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT', headers: getAuthHeaders(),
            body: JSON.stringify({ units_preference: unit })
        });
        currentUser.units_preference = unit;
        showToast(`Switched to ${unit === 'metric' ? 'Metric (cm/kg)' : 'Imperial (ft/lbs)'}`, 'success');
        populateHealthSummary();
    } catch (e) { showToast('Could not save unit preference.', 'error'); }
}

async function saveNotifSetting(field, value) {
    try {
        const payload = {}; payload[field] = value;
        const res = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
        if (res.ok) {
            currentUser[field] = value;
            showToast('Notification preference saved.', 'success');
        }
    } catch (e) { showToast('Failed to save preference.', 'error'); }
}

async function handleAccountUpdate(event) {
    event.preventDefault();
    const email = document.getElementById('settings-email').value;
    const password = document.getElementById('settings-password').value;
    const payload = {};
    if (email) payload.email = email;
    if (password) payload.password = password;
    if (!Object.keys(payload).length) { showToast('No changes to save.', 'info'); return; }

    try {
        const res = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data; updateUserBadge();
            document.getElementById('settings-password').value = '';
            showToast('Account updated successfully!', 'success');
        } else {
            showToast(data.detail || 'Update failed.', 'error');
        }
    } catch (e) { showToast('Server error. Please try again.', 'error'); }
}

// ── Measurements Save ──────────────────────────────
async function handleSaveMeasurements(event) {
    event.preventDefault();
    let valid = true;

    // Validate inputs
    const rawH = parseFloat(document.getElementById('m-height').value);
    const rawW = parseFloat(document.getElementById('m-weight').value);
    const age  = parseInt(document.getElementById('m-age').value);
    const gender = document.getElementById('m-gender').value;
    const rawTW = parseFloat(document.getElementById('m-target-weight').value);

    // Height validation
    const hErr = document.getElementById('err-height');
    const hLimits = profileUnits === 'imperial' ? [1.6, 9] : [50, 280];
    if (!rawH || rawH < hLimits[0] || rawH > hLimits[1]) {
        hErr.classList.remove('hidden'); valid = false;
    } else { hErr.classList.add('hidden'); }

    // Weight validation
    const wErr = document.getElementById('err-weight');
    const wLimits = profileUnits === 'imperial' ? [22, 880] : [10, 400];
    if (!rawW || rawW < wLimits[0] || rawW > wLimits[1]) {
        wErr.classList.remove('hidden'); valid = false;
    } else { wErr.classList.add('hidden'); }

    // Age validation
    const aErr = document.getElementById('err-age');
    if (age && (age < 1 || age > 120)) {
        aErr.classList.remove('hidden'); valid = false;
    } else { aErr.classList.add('hidden'); }

    if (!valid) { showToast('Please fix the highlighted fields.', 'error'); return; }

    // Convert to metric for backend storage
    const heightCm = profileUnits === 'imperial' ? ftToCm(rawH) : rawH;
    const weightKg = profileUnits === 'imperial' ? lbsToKg(rawW) : rawW;
    const targetWKg = rawTW ? (profileUnits === 'imperial' ? lbsToKg(rawTW) : rawTW) : null;

    const payload = {
        height_cm: heightCm, weight_kg: weightKg,
        age: age || null, gender: gender || null,
        activity_level: selectedActivity,
        target_weight: targetWKg || null
    };

    const btn = document.getElementById('save-measurements-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

    try {
        const res = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            updateUserBadge();
            populateProfileHero();
            populateNutritionGoals();
            populateHealthSummary();

            if (data.bmi) {
                renderBMIDisplay(data.bmi, data.bmi_category);
                generateAIInsights(data);
                renderWeightChart();
                renderBMITrendChart();
            }
            showToast('Measurements saved & goals recalculated!', 'success');
        } else {
            showToast(data.detail || 'Could not save measurements.', 'error');
        }
    } catch (e) {
        showToast('Server connection error.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Measurements';
    }
}

// ── Edit Profile Modal ─────────────────────────────
function openProfileEditModal() {
    const u = currentUser;
    document.getElementById('ep-username').value = u.username || '';
    document.getElementById('ep-email').value = u.email || '';
    document.getElementById('ep-age').value = u.age || '';
    document.getElementById('ep-gender').value = u.gender || '';
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeProfileEditModal(event) {
    if (event.target === event.currentTarget) closeProfileEditModalDirect();
}

function closeProfileEditModalDirect() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function handleEditProfileSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('ep-email').value;
    const age = parseInt(document.getElementById('ep-age').value) || null;
    const gender = document.getElementById('ep-gender').value || null;

    try {
        const res = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT', headers: getAuthHeaders(),
            body: JSON.stringify({ email, age, gender })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            updateUserBadge();
            populateProfileHero();
            closeProfileEditModalDirect();
            showToast('Profile updated!', 'success');
            // Re-trigger BMI calculation if body metrics already set
            if (data.bmi) {
                renderBMIDisplay(data.bmi, data.bmi_category);
                generateAIInsights(data);
            }
        } else {
            showToast(data.detail || 'Update failed.', 'error');
        }
    } catch (e) {
        showToast('Server connection error.', 'error');
    }
}

// ── Unit Conversion Helpers ────────────────────────
const kgToLbs = kg => +(kg * 2.20462).toFixed(2);
const lbsToKg = lbs => +(lbs / 2.20462).toFixed(2);
const cmToFt  = cm => +(cm / 30.48).toFixed(2);
const ftToCm  = ft => +(ft * 30.48).toFixed(2);
const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// ── Admin Panel Controllers ───────────────────────────
let currentAdminTab = 'users';
let adminUsersData = [];   // cached user list for client-side search/sort
let adminSortField = 'id';
let adminSortAsc = true;

async function loadAdminDashboard() {
    if (!currentUser || !currentUser.is_admin) {
        showToast('Access denied.', 'error');
        navigateTo('dashboard');
        return;
    }

    try {
        // 1. Fetch enriched users list
        const usersRes = await fetch(`${API_BASE}/api/admin/users`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (usersRes.ok) {
            adminUsersData = await usersRes.json();
            renderAdminUsers(adminUsersData);
        }

        // 2. Fetch analytics
        const analyticsRes = await fetch(`${API_BASE}/api/admin/analytics`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (analyticsRes.ok) {
            const analytics = await analyticsRes.json();
            // Update stat cards
            document.getElementById('admin-stat-users').textContent = analytics.total_users;
            document.getElementById('admin-stat-meals').textContent = analytics.total_meals;
            document.getElementById('admin-stat-dau').textContent = analytics.daily_active_users;
            document.getElementById('admin-stat-wau').textContent = analytics.weekly_active_users;
            // Render analytics tab
            renderAnalytics(analytics);
        }
    } catch (e) {
        console.error('Error loading admin dashboard:', e);
        showToast('Failed to load admin dashboard data.', 'error');
    }
}

// ── Tab Switching ────────────────────────────────────────────────────────────

function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    const tabs = ['users', 'detail', 'analytics'];

    // Toggle active tab buttons
    tabs.forEach(t => {
        const btn = document.getElementById(`admin-tab-btn-${t}`);
        const content = document.getElementById(`admin-tab-${t}`);
        if (btn) btn.classList.remove('active');
        if (content) content.classList.add('hidden');
    });

    const activeBtn = document.getElementById(`admin-tab-btn-${tabName}`);
    const activeContent = document.getElementById(`admin-tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.remove('hidden');

    // Show/hide detail tab button
    const detailBtn = document.getElementById('admin-tab-btn-detail');
    if (tabName === 'detail') {
        detailBtn.style.display = '';
    }

    // Load analytics data on tab switch if needed
    if (tabName === 'analytics') {
        loadAdminAnalytics();
    }
}

async function loadAdminAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/analytics`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            renderAnalytics(data);
        }
    } catch (e) {
        console.error('Error loading analytics:', e);
    }
}

// ── Users Table: Search ─────────────────────────────────────────────────────

function handleAdminUserSearch(query) {
    if (!query || query.trim() === '') {
        renderAdminUsers(adminUsersData);
        return;
    }
    const q = query.toLowerCase().trim();
    const filtered = adminUsersData.filter(u =>
        u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
    renderAdminUsers(filtered);
}

// ── Users Table: Sort ───────────────────────────────────────────────────────

function sortAdminUsers(field) {
    if (adminSortField === field) {
        adminSortAsc = !adminSortAsc;
    } else {
        adminSortField = field;
        adminSortAsc = true;
    }

    const searchVal = document.getElementById('admin-user-search')?.value || '';
    let dataToSort = [...adminUsersData];
    if (searchVal.trim()) {
        const q = searchVal.toLowerCase().trim();
        dataToSort = dataToSort.filter(u =>
            u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
    }

    dataToSort.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return adminSortAsc ? -1 : 1;
        if (valA > valB) return adminSortAsc ? 1 : -1;
        return 0;
    });

    renderAdminUsers(dataToSort);
}

// ── Render Users Table ──────────────────────────────────────────────────────

function renderAdminUsers(users) {
    const listBody = document.getElementById('admin-users-list');
    listBody.innerHTML = '';

    if (users.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem; color:var(--text-muted);">No users found.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        }) : '\u2014';

        const lastActive = user.last_active ? new Date(user.last_active).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        }) : 'Never';

        const isSelf = user.id === currentUser.id;
        const isActive = user.is_active !== false;

        // Status toggle
        const statusHtml = isSelf
            ? `<span class="admin-status-label active">Active (You)</span>`
            : `<div class="admin-status-toggle">
                 <label class="toggle-switch">
                   <input type="checkbox" ${isActive ? 'checked' : ''} onchange="handleToggleUserStatus(${user.id}, this.checked)">
                   <span class="toggle-slider"></span>
                 </label>
                 <span class="admin-status-label ${isActive ? 'active' : 'disabled'}">${isActive ? 'Active' : 'Disabled'}</span>
               </div>`;

        // Delete button
        const deleteBtnHtml = isSelf
            ? ''
            : `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); handleDeleteUser(${user.id}, '${user.username.replace(/'/g, "\\'")}')" title="Delete user">
                 <i class="fa-solid fa-trash"></i>
               </button>`;

        const tr = document.createElement('tr');
        tr.className = 'clickable-row';
        tr.onclick = () => handleViewUserDetail(user.id);
        tr.innerHTML = `
            <td><strong>#${user.id}</strong></td>
            <td>
                ${user.username}
                ${user.is_admin ? '<span class="role-badge admin" style="margin-left:0.5rem;">Admin</span>' : ''}
            </td>
            <td>${user.email}</td>
            <td><strong>${user.meal_count}</strong></td>
            <td>${lastActive}</td>
            <td onclick="event.stopPropagation();">${statusHtml}</td>
            <td class="text-right" onclick="event.stopPropagation();">${deleteBtnHtml}</td>
        `;
        listBody.appendChild(tr);
    });
}

// ── Toggle User Status ──────────────────────────────────────────────────────

async function handleToggleUserStatus(userId, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_active: newStatus })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'User status updated.', 'success');
            // Update cached data
            const userIdx = adminUsersData.findIndex(u => u.id === userId);
            if (userIdx !== -1) {
                adminUsersData[userIdx].is_active = newStatus;
            }
            renderAdminUsers(adminUsersData);
        } else {
            showToast(data.detail || 'Failed to update user status.', 'error');
            renderAdminUsers(adminUsersData);
        }
    } catch (e) {
        showToast('Server connection error.', 'error');
        renderAdminUsers(adminUsersData);
    }
}

// ── Delete User ─────────────────────────────────────────────────────────────

async function handleDeleteUser(userId, username) {
    if (!confirm(`Are you absolutely sure you want to delete user "${username}" (ID: ${userId})? This will delete all their meal scans and metrics permanently!`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'User deleted successfully.', 'success');
            adminUsersData = adminUsersData.filter(u => u.id !== userId);
            renderAdminUsers(adminUsersData);
            document.getElementById('admin-stat-users').textContent = adminUsersData.length;
        } else {
            showToast(data.detail || 'Failed to delete user.', 'error');
        }
    } catch (e) {
        showToast('Server connection error.', 'error');
    }
}

// ── View User Detail ────────────────────────────────────────────────────────

async function handleViewUserDetail(userId) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            showToast('Failed to load user details.', 'error');
            return;
        }

        const user = await res.json();
        renderUserDetail(user);

        document.getElementById('admin-detail-tab-label').textContent = user.username;
        switchAdminTab('detail');
    } catch (e) {
        console.error('Error loading user detail:', e);
        showToast('Failed to load user details.', 'error');
    }
}

function renderUserDetail(user) {
    const container = document.getElementById('admin-user-detail-content');

    const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    }) : '\u2014';

    const lastActive = user.last_active ? new Date(user.last_active).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    }) : 'Never';

    const statusClass = user.is_active !== false ? 'active' : 'disabled';
    const statusText = user.is_active !== false ? 'Active' : 'Disabled';

    let html = `
        <div class="admin-user-detail-header">
            <div class="admin-user-detail-avatar">
                <i class="fa-solid fa-user-circle"></i>
            </div>
            <div class="admin-user-detail-info">
                <h2>${user.username} ${user.is_admin ? '<span class="role-badge admin">Admin</span>' : ''}</h2>
                <p><i class="fa-solid fa-envelope"></i> ${user.email}</p>
                <div class="admin-user-detail-badges">
                    <span class="admin-detail-badge"><i class="fa-solid fa-calendar-plus"></i> Joined ${joinDate}</span>
                    <span class="admin-detail-badge"><i class="fa-solid fa-clock"></i> Last active: ${lastActive}</span>
                    <span class="admin-detail-badge"><i class="fa-solid fa-utensils"></i> ${user.meal_count} meals</span>
                    <span class="admin-detail-badge admin-status-label ${statusClass}"><i class="fa-solid fa-circle"></i> ${statusText}</span>
                    ${user.age ? `<span class="admin-detail-badge"><i class="fa-solid fa-cake-candles"></i> ${user.age} years</span>` : ''}
                    ${user.gender ? `<span class="admin-detail-badge"><i class="fa-solid fa-venus-mars"></i> ${capitalize(user.gender)}</span>` : ''}
                    ${user.bmi ? `<span class="admin-detail-badge"><i class="fa-solid fa-heart-pulse"></i> BMI: ${user.bmi} (${capitalize(user.bmi_category || '')})</span>` : ''}
                </div>
            </div>
        </div>
    `;

    // Daily targets
    html += `
        <div class="admin-detail-targets">
            <div class="admin-detail-target-card">
                <div class="target-value">${user.daily_calorie_target || '\u2014'}</div>
                <div class="target-label">Calories Target</div>
            </div>
            <div class="admin-detail-target-card">
                <div class="target-value">${user.protein_goal ? user.protein_goal + 'g' : '\u2014'}</div>
                <div class="target-label">Protein Goal</div>
            </div>
            <div class="admin-detail-target-card">
                <div class="target-value">${user.carbs_goal ? user.carbs_goal + 'g' : '\u2014'}</div>
                <div class="target-label">Carbs Goal</div>
            </div>
            <div class="admin-detail-target-card">
                <div class="target-value">${user.fat_goal ? user.fat_goal + 'g' : '\u2014'}</div>
                <div class="target-label">Fat Goal</div>
            </div>
            <div class="admin-detail-target-card">
                <div class="target-value">${user.weight_kg ? user.weight_kg + ' kg' : '\u2014'}</div>
                <div class="target-label">Weight</div>
            </div>
            <div class="admin-detail-target-card">
                <div class="target-value">${user.height_cm ? user.height_cm + ' cm' : '\u2014'}</div>
                <div class="target-label">Height</div>
            </div>
        </div>
    `;

    // Meal history
    if (user.meals && user.meals.length > 0) {
        html += `<h3 class="admin-detail-meals-title"><i class="fa-solid fa-clock-rotate-left"></i> Meal History (${user.meals.length})</h3>`;
        html += `<div class="admin-detail-meal-list">`;

        user.meals.forEach(meal => {
            const mealDate = meal.created_at ? new Date(meal.created_at).toLocaleString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '\u2014';

            const imgUrl = meal.image_path
                ? `${API_BASE}/uploads/${meal.image_path.split(/[\\/]/).pop()}`
                : '';

            const itemTags = (meal.items || []).map(item =>
                `<span class="food-tag">${item.name} (${Math.round(item.calories)} kcal)</span>`
            ).join('');

            html += `
                <div class="admin-detail-meal-card">
                    ${imgUrl ? `<img src="${imgUrl}" class="admin-detail-meal-thumb" alt="Meal" onerror="this.style.display='none'">` : ''}
                    <div class="admin-detail-meal-info">
                        <div class="meal-date">${mealDate}</div>
                        <div class="meal-cals">${Math.round(meal.total_calories)} kcal</div>
                        <div class="meal-macros">P: ${Math.round(meal.total_protein)}g | C: ${Math.round(meal.total_carbs)}g | F: ${Math.round(meal.total_fat)}g</div>
                        ${itemTags ? `<div class="admin-detail-meal-items">${itemTags}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    } else {
        html += `<div class="admin-empty-state">
            <i class="fa-solid fa-utensils"></i>
            <p>No meals logged yet.</p>
        </div>`;
    }

    container.innerHTML = html;
}

// ── Render Analytics ────────────────────────────────────────────────────────

function renderAnalytics(data) {
    // Detection Success Rate Gauge
    const pct = data.detection_success_rate || 0;
    const circumference = 314.16;
    const offset = circumference - (pct / 100) * circumference;

    const ring = document.getElementById('analytics-success-ring');
    if (ring) {
        ring.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(() => {
            ring.setAttribute('stroke-dashoffset', offset);
        }, 100);
    }

    const pctText = document.getElementById('analytics-success-pct');
    if (pctText) {
        animateNumber(pctText, 0, pct, 1000);
    }

    // Top Foods Bar Chart
    const chartContainer = document.getElementById('analytics-top-foods');
    if (!chartContainer) return;

    if (!data.top_foods || data.top_foods.length === 0) {
        chartContainer.innerHTML = `<div class="admin-empty-state">
            <i class="fa-solid fa-chart-bar"></i>
            <p>No food detection data available yet.</p>
        </div>`;
        return;
    }

    const maxCount = data.top_foods[0].count;
    chartContainer.innerHTML = data.top_foods.map((food, idx) => {
        const widthPct = Math.max((food.count / maxCount) * 100, 8);
        const barColors = [
            'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #f59e0b, #d97706)',
            'linear-gradient(135deg, #ec4899, #db2777)',
            'linear-gradient(135deg, #6366f1, #4f46e5)',
            'linear-gradient(135deg, #14b8a6, #0d9488)',
            'linear-gradient(135deg, #f97316, #ea580c)',
            'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'linear-gradient(135deg, #06b6d4, #0891b2)',
            'linear-gradient(135deg, #84cc16, #65a30d)'
        ];
        return `
            <div class="analytics-bar-row">
                <span class="analytics-bar-label">${food.name}</span>
                <div class="analytics-bar-track">
                    <div class="analytics-bar-fill" style="width: 0%; background: ${barColors[idx % barColors.length]};" data-target-width="${widthPct}%">
                        <span class="analytics-bar-count">${food.count}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Animate bars in
    setTimeout(() => {
        chartContainer.querySelectorAll('.analytics-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.targetWidth;
        });
    }, 100);
}

// Helper: animate a number from start to end
function animateNumber(el, start, end, duration) {
    const startTime = performance.now();
    const isFloat = !Number.isInteger(end);

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * eased;

        el.textContent = isFloat ? current.toFixed(1) : Math.round(current);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}
