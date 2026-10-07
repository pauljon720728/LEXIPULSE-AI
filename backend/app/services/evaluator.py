import datetime
from typing import Dict, Any, List
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, precision_score, recall_score
from app.services.nlp_pipeline import nlp_pipeline

# 50 Ground Truth Benchmark Samples for Viva Evaluation
BENCHMARK_EVALUATION_SET = [
    # Critical Urgency Samples (Violence, Life Threat, Extortion Deadline)
    {"text": "Mere pati ne mujhe kamre me band kar diya hai aur jaan se marne ki dhamki de raha hai, madad karo!", "lang": "hi", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Domestic Violence & Abuse"},
    {"text": "They have given me a deadline until 6 PM to pay ransom or they will kidnap my daughter. Please help immediately!", "lang": "en", "true_urgency": "Critical", "true_emotion": "desperation", "true_category": "Police Negligence & Misconduct"},
    {"text": "Nannu champi vestanani rowdylatho intiki vachi bediristunnaru, pranabhayam ga undi.", "lang": "te", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Property Dispute"},
    {"text": "Amake khun korar humki dewa hochhe continuous, ami ar bachte parbona e bhabe.", "lang": "bn", "true_urgency": "Critical", "true_emotion": "desperation", "true_category": "Domestic Violence & Abuse"},
    {"text": "Acid attack threat has been made against me outside my coaching center today. I am terrified.", "lang": "en", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Workplace Harassment"},
    {"text": "Mujhe qatl karne ke liye gunde bheje hain mere padosi ne, police bhi nahi sun rahi!", "lang": "ur", "true_urgency": "Critical", "true_emotion": "anger", "true_category": "Property Dispute"},
    {"text": "En uyirukku aabathu irukkirathu kaapattrungal, veetai sutri aatkall sutri varugirargal.", "lang": "ta", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Domestic Violence & Abuse"},
    {"text": "My ex-partner broke into my house with a knife and is threatening to kill me right now.", "lang": "en", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Domestic Violence & Abuse"},
    {"text": "Husband physically assaulted me causing severe bleeding and locked the doors.", "lang": "en", "true_urgency": "Critical", "true_emotion": "distress", "true_category": "Domestic Violence & Abuse"},
    {"text": "Chachi pothanu ane paristithi vachindi, rowdy lu maa illu pelchesthamani cheptunnaru.", "lang": "te", "true_urgency": "Critical", "true_emotion": "desperation", "true_category": "Property Dispute"},

    # High Urgency Samples (Financial Drain, Stalking, Active Extortion)
    {"text": "Mere bank khate se 1,50,000 rupaye cyber fraud me nikal gaye bina kisi OTP ke.", "lang": "hi", "true_urgency": "High", "true_emotion": "distress", "true_category": "Cybercrime"},
    {"text": "A man is stalking me from office to my PG every evening and taking photos continuously.", "lang": "en", "true_urgency": "High", "true_emotion": "fear", "true_category": "Workplace Harassment"},
    {"text": "Naa bank account nundi 80000 rupees unauthorized debit ayindi cyber fraud dwara.", "lang": "te", "true_urgency": "High", "true_emotion": "distress", "true_category": "Cybercrime"},
    {"text": "Landlord has illegally cut our electricity and water supply to force immediate eviction.", "lang": "en", "true_urgency": "High", "true_emotion": "anger", "true_category": "Property Dispute"},
    {"text": "Amar bank account theke shob taka churi hoye geche phishing link click korar por.", "lang": "bn", "true_urgency": "High", "true_emotion": "distress", "true_category": "Cybercrime"},
    {"text": "Someone created a fake Instagram profile with morphed obscene photos of me and is blackmailing.", "lang": "en", "true_urgency": "High", "true_emotion": "distress", "true_category": "Cybercrime"},
    {"text": "Builder took 40 lakhs advance for flat possession and has absconded closing the office.", "lang": "en", "true_urgency": "High", "true_emotion": "anger", "true_category": "Financial & Banking Fraud"},
    {"text": "Maa polam lo boundary stones teesesaru, dabbulu ivvakapothe nasanam chestharu.", "lang": "te", "true_urgency": "High", "true_emotion": "anger", "true_category": "Property Dispute"},
    {"text": "Manager at workplace is demanding sexual favors in exchange for annual bonus and promotion.", "lang": "en", "true_urgency": "High", "true_emotion": "distress", "true_category": "Workplace Harassment"},
    {"text": "Enathu panam cyber mosadi moolam thirudappattathu, udanadiyaaga thadukkavum.", "lang": "ta", "true_urgency": "High", "true_emotion": "distress", "true_category": "Cybercrime"},

    # Medium Urgency Samples (Contract disputes, salary delays, consumer fraud)
    {"text": "Company has not paid my salary for past 3 months despite multiple reminders and requests.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Labor & Employment Dispute"},
    {"text": "Bought refrigerator from ecommerce platform, received damaged unit and refund is refused.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Consumer Dispute"},
    {"text": "Padosi ne balcony me illegal construction kar liya hai jisse mera rasta ruk gaya hai.", "lang": "hi", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Property Dispute"},
    {"text": "Car service center charged Rs 28,000 without replacing required parts as per invoice.", "lang": "en", "true_urgency": "Medium", "true_emotion": "anger", "true_category": "Consumer Dispute"},
    {"text": "Contractor abandoned construction work midway after taking 50% mobilization advance.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Financial & Banking Fraud"},
    {"text": "Maa office lo 4 months nundi salary ivvaledhu, family maintain cheyadam kashtam ayyindi.", "lang": "te", "true_urgency": "Medium", "true_emotion": "distress", "true_category": "Labor & Employment Dispute"},
    {"text": "Mobile network provider deducts daily balance for unactivated VAS subscriptions.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Consumer Dispute"},
    {"text": "Police station thanedar is demanding Rs 5,000 bribe to file simple lost purse complaint.", "lang": "en", "true_urgency": "Medium", "true_emotion": "anger", "true_category": "Police Negligence & Misconduct"},
    {"text": "Bought flight ticket online, flight cancelled by airline but refund withheld for 90 days.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Consumer Dispute"},
    {"text": "Factory owner refuses to pay overtime wages to contract workers for past six months.", "lang": "en", "true_urgency": "Medium", "true_emotion": "anger", "true_category": "Labor & Employment Dispute"},

    # Low Urgency Samples (Routine queries, noise complaints, status checks)
    {"text": "Requesting clarification on property mutation application status submitted 2 weeks ago.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Property Dispute"},
    {"text": "Neighbor plays loud music during evening festival celebrations creating mild disturbance.", "lang": "en", "true_urgency": "Low", "true_emotion": "frustration", "true_category": "Consumer Dispute"},
    {"text": "Voter ID card correction application has minor spelling error in middle name.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Consumer Dispute"},
    {"text": "Patta passbook application number AP99281 status inquiry for survey verification.", "lang": "te", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Property Dispute"},
    {"text": "General inquiry regarding documents required for new domestic water connection.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Consumer Dispute"},
    {"text": "Street light in our residential lane has been flickering for three days.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Consumer Dispute"},
    {"text": "Request to verify boundary survey measurement certificate issued by municipal surveyor.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Property Dispute"},
    {"text": "Inquiry regarding consumer grievance mediation process and hearing dates.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Consumer Dispute"},
    {"text": "Ration card address update application submitted online, tracking status needed.", "lang": "hi", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Consumer Dispute"},
    {"text": "Lost driving license while traveling in local bus, need duplicate copy certificate.", "lang": "en", "true_urgency": "Low", "true_emotion": "neutral", "true_category": "Police Negligence & Misconduct"},

    # Additional Diverse Emotion & Multilingual Samples
    {"text": "Hamare gaon me ration mafia ne pura anaj black market me bech diya hai, hum bhooke mar rahe hain!", "lang": "hi", "true_urgency": "High", "true_emotion": "desperation", "true_category": "Financial & Banking Fraud"},
    {"text": "I feel completely hopeless and heartbroken after losing my life savings to a fake stock tip group.", "lang": "en", "true_urgency": "High", "true_emotion": "sadness", "true_category": "Financial & Banking Fraud"},
    {"text": "The sheer arrogance and apathy of the municipal officers has made our entire colony suffer.", "lang": "en", "true_urgency": "Medium", "true_emotion": "anger", "true_category": "Police Negligence & Misconduct"},
    {"text": "Bank manager mocked our poor background and refused student education loan application.", "lang": "en", "true_urgency": "Medium", "true_emotion": "sadness", "true_category": "Financial & Banking Fraud"},
    {"text": "Evaru pattinchukovadam ledhu, roju police station ki tirigi tirigi alasipoyamu.", "lang": "te", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Police Negligence & Misconduct"},
    {"text": "Office colleague sends unwanted messages late at night despite clear refusal.", "lang": "en", "true_urgency": "High", "true_emotion": "distress", "true_category": "Workplace Harassment"},
    {"text": "Shameful corruption! Police inspector asked 20,000 cash openly on camera to record theft statement.", "lang": "en", "true_urgency": "High", "true_emotion": "anger", "true_category": "Police Negligence & Misconduct"},
    {"text": "My retired father's pension has been arbitrarily stopped without any prior notice.", "lang": "en", "true_urgency": "Medium", "true_emotion": "distress", "true_category": "Labor & Employment Dispute"},
    {"text": "Online merchant delivered empty box instead of laptop and customer support closed ticket.", "lang": "en", "true_urgency": "Medium", "true_emotion": "frustration", "true_category": "Consumer Dispute"},
    {"text": "We are facing continuous threats of eviction and goons were sent to vandalize our shop.", "lang": "en", "true_urgency": "Critical", "true_emotion": "fear", "true_category": "Property Dispute"}
]

class EvaluatorService:
    def evaluate_model(self) -> Dict[str, Any]:
        """Run inference on the 50 ground truth samples and compute detailed evaluation metrics."""
        y_true_urg = []
        y_pred_urg = []
        y_true_emo = []
        y_pred_emo = []
        y_true_cat = []
        y_pred_cat = []

        per_lang = {}

        for item in BENCHMARK_EVALUATION_SET:
            lang = item["lang"]
            if lang not in per_lang:
                per_lang[lang] = {"total": 0, "correct_urgency": 0, "correct_emotion": 0}

            # Run NLP pipeline
            res = nlp_pipeline.process_complaint(item["text"])

            p_urg = res["urgency_label"]
            p_emo = res["emotion_label"]
            p_cat = res["category"]

            y_true_urg.append(item["true_urgency"])
            y_pred_urg.append(p_urg)

            y_true_emo.append(item["true_emotion"])
            y_pred_emo.append(p_emo)

            y_true_cat.append(item["true_category"])
            y_pred_cat.append(p_cat)

            per_lang[lang]["total"] += 1
            if p_urg.lower() == item["true_urgency"].lower():
                per_lang[lang]["correct_urgency"] += 1
            if p_emo.lower() == item["true_emotion"].lower():
                per_lang[lang]["correct_emotion"] += 1

        # Calculate metrics
        urg_acc = accuracy_score(y_true_urg, y_pred_urg)
        urg_f1 = f1_score(y_true_urg, y_pred_urg, average="macro", zero_division=0)

        emo_acc = accuracy_score(y_true_emo, y_pred_emo)
        emo_f1 = f1_score(y_true_emo, y_pred_emo, average="macro", zero_division=0)

        cat_acc = accuracy_score(y_true_cat, y_pred_cat)

        urg_labels = ["Critical", "High", "Medium", "Low"]
        cm_urg = confusion_matrix(y_true_urg, y_pred_urg, labels=urg_labels).tolist()

        emo_labels = ["anger", "fear", "distress", "neutral", "desperation", "frustration", "sadness"]
        cm_emo = confusion_matrix(y_true_emo, y_pred_emo, labels=emo_labels).tolist()

        # Per language accuracy dictionary
        lang_metrics = {}
        for l_code, stats in per_lang.items():
            tot = stats["total"]
            lang_metrics[l_code] = {
                "total": tot,
                "urgency_accuracy": round((stats["correct_urgency"] / tot) * 100, 1),
                "emotion_accuracy": round((stats["correct_emotion"] / tot) * 100, 1)
            }

        return {
            "total_samples": len(BENCHMARK_EVALUATION_SET),
            "emotion_accuracy": round(emo_acc * 100, 2),
            "emotion_f1_macro": round(emo_f1, 4),
            "urgency_accuracy": round(urg_acc * 100, 2),
            "urgency_f1_macro": round(urg_f1, 4),
            "category_accuracy": round(cat_acc * 100, 2),
            "confusion_matrix_urgency": {
                "labels": urg_labels,
                "matrix": cm_urg
            },
            "confusion_matrix_emotion": {
                "labels": emo_labels,
                "matrix": cm_emo
            },
            "per_language_accuracy": lang_metrics,
            "evaluated_at": datetime.datetime.utcnow().isoformat()
        }

evaluator_service = EvaluatorService()
