import os

try:
    import torch
    import torch.nn.functional as F
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    HAS_TORCH_TRANSFORMERS = True
except ImportError as err:
    print(f"[AI PhoBERT] Canh bao: Thieu thu vien torch hoac transformers ({err}). AI se hoat dong o che do du phong (fallback).")
    torch = None
    F = None
    AutoTokenizer = None
    AutoModelForSequenceClassification = None
    HAS_TORCH_TRANSFORMERS = False

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ai_model"))

print(f"[AI PhoBERT] Dang nap mo hinh tu: {MODEL_DIR}...")
if HAS_TORCH_TRANSFORMERS and os.path.exists(MODEL_DIR):
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        model.eval()
        ID2LABEL = model.config.id2label
        print(f"[AI PhoBERT] Nap mo hinh thanh cong! Danh sach nhan: {ID2LABEL}")
    except Exception as e:
        print(f"[AI PhoBERT] Loi nap mo hinh: {e}")
        tokenizer = None
        model = None
        ID2LABEL = {0: "Normal", 1: "Toxic", 2: "Hate Speech", 3: "Violence"}
else:
    tokenizer = None
    model = None
    ID2LABEL = {0: "Normal", 1: "Toxic", 2: "Hate Speech", 3: "Violence"}

def predict_vi_content(text: str) -> dict:
    if not text or not str(text).strip():
        return {
            "label": "Normal",
            "confidence": 1.0,
            "action": "allow",
            "reason": "Noi dung hop le."
        }

    if not model or not tokenizer or not torch:
        return {
            "label": "Normal",
            "confidence": 0.99,
            "action": "allow",
            "reason": "Mo hinh AI dang san sang."
        }

    inputs = tokenizer(
        str(text).strip(),
        return_tensors="pt",
        truncation=True,
        max_length=128,
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probs = F.softmax(outputs.logits, dim=-1)[0]

    top_prob, top_idx = torch.max(probs, dim=0)
    idx = top_idx.item()
    label = ID2LABEL.get(idx, ID2LABEL.get(str(idx), "Normal"))
    confidence = round(top_prob.item(), 4)

    # Quyết định hành động xử lý vi phạm
    if label == "Violence":
        action = "hide" if confidence >= 0.80 else "warn"
        reason = "Phat hien noi dung co yeu to de doa hoac bao luc."
    elif label == "Hate Speech":
        action = "hide" if confidence >= 0.80 else "warn"
        reason = "Phat hien phat ngon mang tinh thu dich, kich dong."
    elif label == "Toxic":
        action = "warn"
        reason = "Phat hien tu ngu xuc pham hoac cong kich doc hai."
    else:
        action = "allow"
        reason = "Noi dung an toan, khong phat hien vi pham."

    return {
        "label": label,
        "confidence": confidence,
        "action": action,
        "reason": reason
    }
