# 🧠 MedAI – Dual AI Medical Report Analysis System

🚀 A next-generation AI-powered medical analysis platform that combines multiple AI models, large-scale medical datasets, and intelligent report interpretation.

## 📌 Overview

MedAI is an advanced healthcare AI system designed to analyze medical reports, detect possible conditions, and provide intelligent insights using:

- 🤖 Dual AI Models (GPT + Gemini)
- 📊 10,000+ Structured Disease Dataset
- 🧠 NLP-based Medical Data Extraction
- 📈 Confidence Scoring System
- 💊 Medicine Suggestions with Visual References

## 🎯 Key Features

### 🔍 Medical Report Analysis
- Upload lab reports (PDF, images, text)
- Extract medical values using OCR + NLP
- Identify abnormal parameters automatically

### 🧠 Dual AI Verification
- ChatGPT + Gemini analysis
- Cross-verification of results
- Reduced hallucination risk

### 📊 Confidence Score System
- AI agreement-based scoring
- Transparent decision-making
- Risk-level classification

### 🦠 Disease Detection
- Matches symptoms + lab data with dataset
- Supports 10,000+ diseases
- Ranks top possible conditions

### 💊 Smart Treatment Suggestions
- General medicine recommendations
- Lifestyle improvements
- Doctor specialization suggestions

### 🖼️ Medicine Visualization
- Displays medicine-related images
- Improves user understanding
- Visual healthcare assistance

## 🏗️ System Architecture

```
User Upload Report
        ↓
OCR / Text Extraction
        ↓
NLP Engine (Value Detection)
        ↓
Dataset Matching (10K Diseases)
        ↓
AI Layer:
   → GPT Analysis
   → Gemini Analysis
        ↓
Comparison Engine
        ↓
Confidence Score
        ↓
Final Output Dashboard
```

## 📚 Research Papers Collection

📄 This project is powered by extensive research from 2020–2026 across top AI and medical conferences.

### 🔬 Latest Research (2026)
- Merlin: CT Vision–Language Foundation Model
- X-WIN: Chest Radiograph World Model
- PriorRG: Contrastive Pre-training for X-ray Reports
- PET2Rep: Automated PET Radiology Report Generation
- CX-Mind: Multimodal Reasoning Model

### 📊 Advanced Research (2025)
- MedRAX: Medical Reasoning Agent
- RadGPT: Tumor Dataset Generation
- MedAgentBench: Medical LLM Benchmark
- DART: Disease-aware Alignment Framework

### 🧠 Core Technologies Covered
- Vision-Language Models (VLMs)
- Multimodal Large Language Models (MLLMs)
- Retrieval-Augmented Generation (RAG)
- Reinforcement Learning in Medical AI
- Explainable AI in Healthcare

### 📂 Datasets & Benchmarks
- MIMIC-CXR
- CheXpert Plus
- VinDr-CXR
- PadChest-GR
- CT-RG Datasets

### 📏 Evaluation Metrics
- RadCliQ
- GREEN Score
- FactScore
- CRIMSON Metric

## 📂 Dataset

📊 10,000+ diseases structured dataset

Includes:
- Symptoms
- Causes
- Lab indicators
- Treatments
- Risk levels

## ⚙️ Tech Stack

### Backend
- FastAPI (Python)
- OpenAI API (GPT)
- Google Gemini API
- NLP Processing

### Frontend
- HTML, CSS, JavaScript
- Modern Dashboard UI
- Responsive Design

### AI/ML
- Dual AI reasoning
- Dataset matching
- Confidence scoring algorithm

## 🚀 Getting Started

### 1️⃣ Clone Repository
```bash
git clone https://github.com/your-username/medai-system.git
cd medai-system
```

### 2️⃣ Setup Backend
```bash
cd backend
pip install -r requirements.txt
```

### 3️⃣ Add API Keys

Create `.env` file:
```
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
```

### 4️⃣ Run Server
```bash
uvicorn app:app --reload
```

### 5️⃣ Run Frontend
```bash
cd frontend
python -m http.server 8000
```

## 📊 Sample Output

- 🧾 Patient Summary
- 🔬 Extracted Medical Data
- 🧠 Possible Conditions (Top 3)
- 📈 Confidence Score
- ⚠️ Risk Level
- 💊 Suggested Medications
- 🧑‍⚕️ Recommended Doctors

## ⚠️ Disclaimer

🚨 This system is for:
- Educational purposes
- AI-assisted insights

❌ Not a replacement for professional medical diagnosis
✔ Always consult a certified doctor

## 🔐 Privacy

- No permanent storage of reports
- Secure API-based processing
- User data is not retained

## 🌟 Why MedAI?

| Feature | Others | MedAI |
|---|---|---|
| Single AI | ✅ | ❌ |
| Dual AI | ❌ | ✅ |
| Confidence Score | ❌ | ✅ |
| Large Dataset | ❌ | ✅ |
| Medicine Images | ❌ | ✅ |

## 🚀 Future Enhancements

- 📱 Mobile App Integration
- 🧬 Real-time health monitoring
- 🧠 AI Doctor Chatbot
- 🌍 Multi-language support

## 🤝 Contributing

Contributions are welcome!
Feel free to fork, improve, and submit PRs.

## 📌 Project Vision

> "Not replacing doctors, but enhancing trust in AI through transparency, verification, and intelligent assistance."

## ❤️ Built For

- Hackathons
- Research Projects
- Healthcare Innovation
- AI Development
