// ============================================================
// MedVerify – script.js
// FULLY CONNECTED TO FLASK BACKEND
// ============================================================
// This file connects every page of your frontend to your
// Flask backend running at http://127.0.0.1:5000
//
// HOW IT WORKS (simple explanation):
//   - fetch() is like sending a letter to your Flask server
//   - Flask reads the letter, checks the database
//   - Flask sends back a reply (JSON data)
//   - We show that data on the page
// ============================================================

// ─────────────────────────────────────────────────────────
// YOUR FLASK BACKEND URL
// This is where your backend is running.
// Change this if your IP or port is different.
// ─────────────────────────────────────────────────────────
const API_BASE = "http://10.61.102.10:5000/api";


// ─────────────────────────────────────────────────────────
// HELPER: Show a loading spinner message
// ─────────────────────────────────────────────────────────
function showLoading(elementId, message = "Loading...") {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<p style="text-align:center; color:#aaa;">⏳ ${message}</p>`;
}

// ─────────────────────────────────────────────────────────
// HELPER: Show an error message inside any element
// ─────────────────────────────────────────────────────────
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<p style="color:#EF4444; text-align:center;">❌ ${message}</p>`;
}


// ============================================================
// LOGIN PAGE  (login.html)
// ============================================================
// NOTE: Login is kept using localStorage (dummy auth).
// You can connect this to a real backend login API later.
// ============================================================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email    = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        let users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);

        // Allow demo login OR registered users
        if (user || (email === 'user@medverify.com' && password === 'password123')) {
            localStorage.setItem('currentUser', JSON.stringify({
                name:  user?.name || 'Demo User',
                email: email,
                role:  email === 'admin@medverify.com' ? 'admin' : 'user'
            }));
            // Redirect admin to admin dashboard, users to user dashboard
            window.location.href = email === 'admin@medverify.com'
                ? 'admin-dashboard.html'
                : 'dashboard.html';
        } else {
            alert('Invalid credentials!\nUse: user@medverify.com / password123');
        }
    });
}


// ============================================================
// REGISTER PAGE  (register.html)
// ============================================================
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const name            = document.getElementById('name').value;
        const email           = document.getElementById('email').value;
        const password        = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        let users = JSON.parse(localStorage.getItem('users') || '[]');
        users.push({ name, email, password, role: 'user' });
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify({ name, email, role: 'user' }));

        alert('Registration successful!');
        window.location.href = 'dashboard.html';
    });
}


// ============================================================
// SCAN PAGE  (scan.html)
// ============================================================
// When user types a QR code and clicks Verify:
//   1. We send the QR code to POST /api/scan
//   2. Flask checks the database
//   3. Flask replies with: status, medicine_name, expiry_date, message
//   4. We save the result and go to result.html
// ============================================================
async function verifyMedicine() {
    const codeInput = document.getElementById('manualCode');
    const code = codeInput?.value?.trim();

    if (!code) {
        alert('Please enter a QR code value first!');
        return;
    }

    // Show loading state on button
    const btn = document.querySelector('.btn-primary');
    if (btn) { btn.textContent = 'Verifying...'; btn.disabled = true; }

    try {
        // ── STEP 1: Call POST /api/scan ──────────────────────
        // fetch() sends a request to your Flask server.
        // 'POST' means we are SENDING data (the qr_code).
        // JSON.stringify converts JS object to text Flask can read.
        const response = await fetch(`${API_BASE}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'  // Tell Flask we are sending JSON
            },
            body: JSON.stringify({
                qr_code:  code,
                location: 'MedVerify App'   // optional location field
            })
        });

        // ── STEP 2: Read Flask's reply ────────────────────────
        // response.json() converts Flask's text reply back to a JS object
        const data = await response.json();

        // ── STEP 3: Save result to localStorage ───────────────
        // We save it so result.html can read it
        localStorage.setItem('lastScanResult', JSON.stringify({
            qr_code:       code,
            status:        data.status,          // "Genuine" / "Fake" / "Expired" / "Suspicious/Fake"
            medicine_name: data.medicine_name,
            expiry_date:   data.expiry_date,
            message:       data.message
        }));

        // ── STEP 4: Save to scan history ──────────────────────
        let scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        scanHistory.unshift({
            id:            Date.now(),
            medicineName:  data.medicine_name || 'Unknown',
            qrCodeValue:   code,
            scannedAt:     new Date().toISOString(),
            resultStatus:  data.status
        });
        localStorage.setItem('scanHistory', JSON.stringify(scanHistory.slice(0, 50)));

        // ── STEP 5: Go to result page ──────────────────────────
        window.location.href = `result.html?code=${encodeURIComponent(code)}`;

    } catch (error) {
        // This runs if Flask is NOT running or network is down
        alert(
            '❌ Cannot connect to backend!\n\n' +
            'Make sure your Flask server is running:\n' +
            'Open terminal → python app.py\n\n' +
            'Error: ' + error.message
        );
    } finally {
        if (btn) { btn.textContent = 'Verify'; btn.disabled = false; }
    }
}


// ============================================================
// RESULT PAGE  (result.html)
// ============================================================
// Reads the saved scan result and displays it beautifully.
// Also fetches FULL medicine details from GET /api/qr/<code>
// ============================================================
if (window.location.pathname.includes('result.html')) {

    const params  = new URLSearchParams(window.location.search);
    const code    = params.get('code');
    const saved   = JSON.parse(localStorage.getItem('lastScanResult') || '{}');

    // Status → display text and color mapping
    const statusConfig = {
        'Genuine':         { emoji: '✅', label: 'GENUINE MEDICINE',   color: '#22C55E' },
        'Expired':         { emoji: '⚠️', label: 'EXPIRED MEDICINE',   color: '#F59E0B' },
        'Suspicious/Fake': { emoji: '🚨', label: 'SUSPICIOUS / FAKE',  color: '#EF4444' },
        'Fake':            { emoji: '❌', label: 'FAKE MEDICINE',       color: '#EF4444' },
        'Error':           { emoji: '⚙️', label: 'ERROR',              color: '#888888' }
    };

    // Show result from saved scan data immediately
    function displayResult(data) {
        const cfg = statusConfig[data.status] || statusConfig['Error'];

        const statusEl  = document.getElementById('resultStatus');
        const contentEl = document.getElementById('resultContent');

        if (statusEl) {
            statusEl.innerHTML = `
                <div style="
                    font-size: 2rem;
                    font-weight: bold;
                    color: ${cfg.color};
                    text-align: center;
                    padding: 10px;
                ">
                    ${cfg.emoji} ${cfg.label}
                </div>
                <p style="text-align:center; color:#aaa; font-size:0.85rem;">${data.message || ''}</p>
            `;
        }

        if (contentEl) {
            contentEl.innerHTML = `
                <div style="padding: 10px;">
                    <div class="info-row">💊 <strong>Medicine:</strong> ${data.medicine_name || 'N/A'}</div>
                    <div class="info-row">📅 <strong>Expiry Date:</strong> ${data.expiry_date || 'N/A'}</div>
                    <div class="info-row">🔑 <strong>QR Code:</strong> ${data.qr_code || code || 'N/A'}</div>
                </div>
            `;
        }
    }

    // Show saved data first (instant display)
    if (saved && saved.status) {
        displayResult(saved);
    }

    // Then fetch FULL details from backend for more info
    if (code) {
        fetch(`${API_BASE}/qr/${encodeURIComponent(code)}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'found' && data.data) {
                    const med = data.data;
                    const contentEl = document.getElementById('resultContent');
                    if (contentEl) {
                        contentEl.innerHTML = `
                            <div style="padding: 10px;">
                                <div class="info-row">💊 <strong>Medicine:</strong> ${med.name}</div>
                                <div class="info-row">🏭 <strong>Manufacturer:</strong> ${med.manufacturer}</div>
                                <div class="info-row">🔢 <strong>Batch Number:</strong> ${med.batch_number}</div>
                                <div class="info-row">📅 <strong>Expiry Date:</strong> ${med.expiry_date}</div>
                                <div class="info-row">🔑 <strong>QR Code:</strong> ${med.qr_code}</div>
                                <div class="info-row">📊 <strong>Scan Count:</strong> ${med.scan_count}</div>
                            </div>
                        `;
                    }
                }
            })
            .catch(() => {
                // If extra fetch fails, saved data is already showing — no problem
            });
    }
}


// ============================================================
// DASHBOARD PAGE  (dashboard.html)
// ============================================================
// Shows user name and total scan count from localStorage
// ============================================================
if (window.location.pathname.includes('dashboard.html')) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');

    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) userNameSpan.textContent = currentUser.name || 'User';

    const scanCountSpan = document.getElementById('scanCount');
    if (scanCountSpan) scanCountSpan.textContent = scanHistory.length;
}


// ============================================================
// ADMIN DASHBOARD PAGE  (admin-dashboard.html)
// ============================================================
// Fetches ALL medicines from GET /api/medicines
// and displays them in a list
// ============================================================
if (window.location.pathname.includes('admin-dashboard.html')) {

    const medicineList  = document.getElementById('medicineList');
    const totalMedEl    = document.getElementById('totalMedicines');

    showLoading('medicineList', 'Fetching medicines from database...');

    // GET /api/medicines → returns array of all medicines
    fetch(`${API_BASE}/medicines`)
        .then(res => {
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            return res.json();
        })
        .then(medicines => {
            // Update total count
            if (totalMedEl) totalMedEl.textContent = medicines.length;

            if (!medicines || medicines.length === 0) {
                if (medicineList) medicineList.innerHTML = '<p>No medicines in database yet.</p>';
                return;
            }

            // Render each medicine as a card
            if (medicineList) {
                medicineList.innerHTML = medicines.map(med => `
                    <div class="glass-card" style="margin: 10px 0; padding: 15px;">
                        <div><strong>${med.name}</strong></div>
                        <div class="small-text">Manufacturer: ${med.manufacturer}</div>
                        <div class="small-text">Batch: ${med.batch_number}</div>
                        <div class="small-text">Expiry: ${med.expiry_date}</div>
                        <div class="small-text">QR Code: ${med.qr_code}</div>
                        <div class="small-text">Scans: ${med.scan_count}</div>
                    </div>
                `).join('');
            }
        })
        .catch(err => {
            showError('medicineList',
                'Cannot load medicines. Is Flask running? (python app.py)\n' + err.message
            );
        });

    // Show report count from localStorage
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const totalReportsEl = document.getElementById('totalReports');
    if (totalReportsEl) totalReportsEl.textContent = reports.length;
}


// ============================================================
// ADD MEDICINE PAGE  (admin-add-medicine.html)
// ============================================================
// Sends new medicine data to POST /api/add-medicine
// ============================================================
if (window.location.pathname.includes('admin-add-medicine.html')) {

    document.getElementById('addMedicineForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();

        const medicineData = {
            name:         document.getElementById('medName').value.trim(),
            manufacturer: document.getElementById('medManufacturer').value.trim(),
            batch_number: document.getElementById('medBatch').value.trim(),
            expiry_date:  document.getElementById('medExpiry').value,      // YYYY-MM-DD format
            qr_code:      document.getElementById('medQRCode').value.trim()
        };

        const btn = document.querySelector('.btn-primary');
        if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }

        try {
            // POST /api/add-medicine → saves medicine to MySQL
            const response = await fetch(`${API_BASE}/add-medicine`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(medicineData)
            });

            const data = await response.json();

            if (response.ok) {
                alert(`✅ ${data.message}\nMedicine ID: ${data.medicine_id}`);
                window.location.href = 'admin-dashboard.html';
            } else {
                alert(`❌ Error: ${data.error}`);
            }

        } catch (error) {
            alert('❌ Cannot connect to backend!\nMake sure Flask is running.\n' + error.message);
        } finally {
            if (btn) { btn.textContent = 'Add Medicine'; btn.disabled = false; }
        }
    });
}


// ============================================================
// HISTORY PAGE  (history.html)
// ============================================================
// Reads scan history from localStorage and shows it
// ============================================================
if (window.location.pathname.includes('history.html')) {
    const historyContainer = document.getElementById('historyList');
    const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');

    const statusEmoji = {
        'Genuine':         '✅',
        'Expired':         '⚠️',
        'Suspicious/Fake': '🚨',
        'Fake':            '❌'
    };

    if (historyContainer) {
        if (scanHistory.length > 0) {
            historyContainer.innerHTML = scanHistory.map(item => `
                <div class="glass-card" style="margin: 10px 0; padding: 15px;">
                    <div><strong>${item.medicineName || 'Unknown'}</strong></div>
                    <div class="small-text">${new Date(item.scannedAt).toLocaleString()}</div>
                    <div class="small-text">QR: ${item.qrCodeValue}</div>
                    <div style="margin-top: 5px;">
                        ${statusEmoji[item.resultStatus] || '❓'} ${item.resultStatus}
                    </div>
                </div>
            `).join('');
        } else {
            historyContainer.innerHTML = `
                <div class="glass-card">
                    <p style="text-align:center;">No scans yet. Start scanning medicines!</p>
                </div>
            `;
        }
    }
}


// ============================================================
// PROFILE PAGE  (profile.html)
// ============================================================
if (window.location.pathname.includes('profile.html')) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const roleEl = document.getElementById('profileRole');

    if (nameEl)  nameEl.textContent  = currentUser.name  || 'User';
    if (emailEl) emailEl.textContent = currentUser.email || 'user@medverify.com';
    if (roleEl)  roleEl.textContent  = currentUser.role === 'admin' ? 'Administrator' : 'Regular User';
}


// ============================================================
// REPORT FAKE MEDICINE PAGE  (report.html)
// ============================================================
if (window.location.pathname.includes('report.html')) {
    document.getElementById('reportForm')?.addEventListener('submit', function(e) {
        e.preventDefault();

        const report = {
            id:           Date.now(),
            medicineName: document.getElementById('reportMedicineName').value,
            batchNumber:  document.getElementById('reportBatchNumber').value,
            description:  document.getElementById('reportDescription').value,
            submittedAt:  new Date().toISOString()
        };

        let reports = JSON.parse(localStorage.getItem('reports') || '[]');
        reports.unshift(report);
        localStorage.setItem('reports', JSON.stringify(reports));

        alert('✅ Report submitted successfully! Our team will investigate.');
        window.location.href = 'dashboard.html';
    });
}


// ============================================================
// LOGOUT (called from any page)
// ============================================================
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// ============================================================
// CAMERA QR SCANNER  (scan.html)
// ============================================================
if (document.getElementById('qr-reader')) {

    const statusEl = document.getElementById('scanStatus');

    const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
                Html5QrcodeScanType.SCAN_TYPE_CAMERA,
                Html5QrcodeScanType.SCAN_TYPE_FILE
            ]
        },
        false
    );

    function onScanSuccess(decodedText) {
        html5QrcodeScanner.clear();

        if (statusEl) {
            statusEl.innerHTML = `✅ QR Scanned: <strong>${decodedText}</strong>`;
            statusEl.style.color = '#22C55E';
        }

        const manualInput = document.getElementById('manualCode');
        if (manualInput) manualInput.value = decodedText;

        setTimeout(() => { verifyMedicine(); }, 1000);
    }

    function onScanFailure(error) { }

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}