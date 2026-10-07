import json
import random
import os

TEMPLATES = [
    # Critical - Fear & Desperation (Physical Threat, Severe Domestic, Kidnap, Extortion)
    {
        "lang": "en", "lang_name": "English", "urgency": "Critical", "emotion": "fear",
        "category": "Domestic Violence & Abuse", "dept": "Women & Child Safety Cell",
        "texts": [
            "My ex-husband broke the lock of our apartment and is holding a knife threatening to kill me and my infant child. Please dispatch emergency squad immediately!",
            "I am being held hostage inside my house by armed moneylenders who are threatening severe physical violence if ransom is not paid by sunset.",
            "Continuous death threats on my phone from an organized extortion syndicate. They sent armed goons to my doorstep and vandalized the entrance today.",
            "Victim of aggravated domestic battery. I have sustained grievous head injuries and need urgent police protection and emergency medical extraction."
        ]
    },
    {
        "lang": "hi", "lang_name": "Hindi", "urgency": "Critical", "emotion": "fear",
        "category": "Domestic Violence & Abuse", "dept": "Women & Child Safety Cell",
        "texts": [
            "Mere pati aur sasural wale dahej ke liye mujhe kamre me band karke maar peet kar rahe hain. Meri jaan ko khatra hai, turant police bhejo!",
            "Gunde mere ghar ke bahar hathiyar lekar khade hain aur bol rahe hain ki bahar aate hi jaan se maar denge. Kripya turant sahayata karein.",
            "Padosi ne meri beti ko acid attack ki dhamki di hai. Hum behad dare hue hain aur ghar se bahar nahi nikal pa rahe hain.",
            "Hathiyaron ke saath dakaity ki koshish hui hai, parivar ke sadasya ghayal hain aur aropi abhi bhi aas paas ghoom rahe hain."
        ]
    },
    {
        "lang": "te", "lang_name": "Telugu", "urgency": "Critical", "emotion": "desperation",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "Maa kutumbanni champesthamu ani rowdylatho bediristunnaru, intlo nundi bayataki vaste pranalu pothayi, kapadandi!",
            "Naa polam aakraminchadaniki rowdylu kathi tho vachi daadi chesaru, raktham karuthondi, ventane police support kavali.",
            "Aasthi vivadam lo maa illu thagalapettadaniki prayatnam chesaru, pillalu bhayam tho edusthunnaru.",
            "Chachipothanu ane paristithi vachindi, nyayam cheyakapothe aathmahatya chesukuntanu ani veedhilo bediristunnaru."
        ]
    },
    {
        "lang": "ta", "lang_name": "Tamil", "urgency": "Critical", "emotion": "fear",
        "category": "Domestic Violence & Abuse", "dept": "Women & Child Safety Cell",
        "texts": [
            "En uyirukku aabathu irukkirathu kaapattrungal, veetukulle aatkall pugunthu thaakkugiraargal.",
            "Kudumba kodumai thaanga mudiyavillai, ennai kolai seiya muyarchi nadakkirathu, udanadiyaaga police thevai.",
            "Aayutham thaangiya aatkall engal veetai muttukaiyittu marana bayam kaattugiraargal."
        ]
    },
    {
        "lang": "bn", "lang_name": "Bengali", "urgency": "Critical", "emotion": "desperation",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "Amake ebong amar poribar ke khun korar humki dewa hochhe gunda der diye, dayakore bachaan!",
            "Bari theke jor kore ber kore diye mar dhor kora hoyeche, amra rasta te achhi praner bhoye."
        ]
    },
    {
        "lang": "ur", "lang_name": "Urdu", "urgency": "Critical", "emotion": "fear",
        "category": "Police Negligence & Misconduct", "dept": "Anti-Corruption & Vigilance Cell",
        "texts": [
            "Mujhe qatl karne ki dhamkiyan mil rahi hain aur thana officer FIR darj karne se mana kar raha hai.",
            "Ghar par hathiyar band afrad ne hamla kiya hai, meri jaan khatre me hai, foran madad bhejein."
        ]
    },
    # Open-Set Languages (Malayalam, Punjabi, Marathi, French, German) to demonstrate fallback chain
    {
        "lang": "ml", "lang_name": "Malayalam", "urgency": "Critical", "emotion": "fear",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "എന്റെ ഭൂമി അയൽവാസി അനധികൃതമായി കൈയേറി വേലി കെട്ടി, ചോദിച്ചപ്പോൾ വധഭീഷണി മുഴക്കി, ജീവന് ഭയമുണ്ട്.",
            "വീട്ടിൽ കയറി ഗുണ്ടകൾ ഭീഷണിപ്പെടുത്തുന്നു, എപ്പോൾ വേണമെങ്കിലും ആക്രമണം ഉണ്ടാകാം, ഉടൻ സംരക്ഷണം നൽകണം."
        ]
    },
    {
        "lang": "pa", "lang_name": "Punjabi", "urgency": "Critical", "emotion": "fear",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "ਸਾਡੀ ਜ਼ਮੀਨ ਉੱਤੇ ਨਾਜਾਇਜ਼ ਕਬਜ਼ਾ ਕੀਤਾ ਗਿਆ ਹੈ ਅਤੇ ਗੁੰਡੇ ਹਥਿਆਰਾਂ ਨਾਲ ਜਾਨੋਂ ਮਾਰਨ ਦੀਆਂ ਧਮਕੀਆਂ ਦੇ ਰਹੇ ਹਨ।",
            "ਰਾਤ ਨੂੰ ਘਰ ਤੇ ਹਮਲਾ ਕੀਤਾ ਗਿਆ, ਅਸੀਂ ਬਹੁਤ ਡਰੇ ਹੋਏ ਹਾਂ, ਪੁਲਿਸ ਤੁਰੰਤ ਮਦਦ ਭੇਜੇ।"
        ]
    },
    {
        "lang": "mr", "lang_name": "Marathi", "urgency": "High", "emotion": "distress",
        "category": "Cybercrime", "dept": "Cyber Crime Cell",
        "texts": [
            "माझ्या बँक खात्यातून ऑनलाइन सायबर फसवणूक करून ५०,००० रुपये परस्पर काढण्यात आले आहेत, तातडीने खाते ब्लॉक करा.",
            "फेक कर्ज ॲप वरून माझे मॉर्फ केलेले फोटो नातेवाईकांना पाठवून ब्लॅकमेल केले जात आहे."
        ]
    },
    {
        "lang": "fr", "lang_name": "French", "urgency": "Medium", "emotion": "frustration",
        "category": "Consumer Dispute", "dept": "Consumer Redressal Forum",
        "texts": [
            "On m'a facturé deux fois pour le même achat en ligne et le service client ne répond pas depuis 3 semaines.",
            "L'appareil électronique livré était totalement défectueux et le vendeur refuse le remboursement légal."
        ]
    },
    {
        "lang": "de", "lang_name": "German", "urgency": "High", "emotion": "distress",
        "category": "Financial & Banking Fraud", "dept": "Economic Offences Wing",
        "texts": [
            "Mein Bankkonto wurde durch Phishing-Betrug um 1200 Euro belastet und der Plattformbetreiber verweigert jede Hilfe.",
            "Unberechtigte Transaktionen wurden über mein Handelskonto ausgeführt, bitte um rechtliche Intervention."
        ]
    },

    # High - Distress & Anger (Cybercrime, Blackmail, Major Fraud, Workplace Harassment)
    {
        "lang": "en", "lang_name": "English", "urgency": "High", "emotion": "distress",
        "category": "Cybercrime", "dept": "Cyber Crime Cell",
        "texts": [
            "Unauthorized debit of Rs 2,40,000 from my retirement account via fraudulent banking link. Need urgent account freeze before funds are siphoned off completely.",
            "A fake profile created with morphed images of me is being circulated among all my workplace colleagues. Blackmailer is demanding Rs 50,000 within 2 hours.",
            "SIM swap fraud perpetrated today morning. Multiple OTPs bypassed and Rs 4,80,000 transferred to unknown mule accounts in another state.",
            "Cryptocurrency trading scam lured my savings of 8 Lakhs under false pretext of guaranteed daily returns. Platform owner blocked all withdrawals."
        ]
    },
    {
        "lang": "hi", "lang_name": "Hindi", "urgency": "High", "emotion": "anger",
        "category": "Financial & Banking Fraud", "dept": "Economic Offences Wing",
        "texts": [
            "Mere bank khate se bina meri ijazat ke 85,000 rupaye nikal liye gaye. Bank branch manager sunwai nahi kar raha hai.",
            "Chit fund company 25 lakh rupaye lekar farar ho gayi hai. Hamare mohalle ke 40 parivar barbaad ho gaye hain.",
            "Fake investment app par mujhse 3 lakh rupaye invest karwa liye gaye aur ab customer support gaali de raha hai.",
            "Builder ne 5 saal pehle flat ke naam par 35 lakh liye the, abhi tak possession nahi diya aur office band kar diya."
        ]
    },
    {
        "lang": "te", "lang_name": "Telugu", "urgency": "High", "emotion": "distress",
        "category": "Cybercrime", "dept": "Cyber Crime Cell",
        "texts": [
            "Naa bank account nundi 50000 rupees cyber fraud lo poyayi, cyber helpline number ki call chesina spandana ledhu.",
            "WhatsApp lo fake loan app vallu morphed photos naa relatives ki pampi blackmail chesthunnaru, chala avamanam ga undi.",
            "Credit card fraud jarigindi, OTP cheppakundane 1,20,000 cut ayyayi, ventane block cheyandi."
        ]
    },
    {
        "lang": "en", "lang_name": "English", "urgency": "High", "emotion": "distress",
        "category": "Workplace Harassment", "dept": "Internal Complaints & Labor Cell",
        "texts": [
            "Senior VP at corporate office repeatedly sends sexually explicit messages and threatened termination if I file POSH complaint.",
            "Severe psychological bullying and caste-based discrimination by department manager leading to medical depression and panic attacks.",
            "Female employee cornered in cabin after office hours. Management actively attempting to suppress evidence from security CCTV cameras."
        ]
    },

    # Medium - Frustration & Distress (Consumer, Labor, Property Delays)
    {
        "lang": "en", "lang_name": "English", "urgency": "Medium", "emotion": "frustration",
        "category": "Consumer Dispute", "dept": "Consumer Redressal Forum",
        "texts": [
            "Ordered high-end electronics item from online portal, received broken defective dummy unit and customer support denied refund request.",
            "Authorized vehicle service station replaced brand-new engine parts with counterfeit replicas resulting in roadside breakdown.",
            "Commercial airline cancelled scheduled departure without notice and has not refunded Rs 38,000 despite elapse of 60 business days.",
            "Air conditioner unit stopped cooling within 15 days of purchase. Brand technician refused warranty service citing arbitrary clauses."
        ]
    },
    {
        "lang": "hi", "lang_name": "Hindi", "urgency": "Medium", "emotion": "frustration",
        "category": "Labor & Employment Dispute", "dept": "Labor Grievance Tribunal",
        "texts": [
            "Company ne pichle 4 mahine se hamari tankhwah nahi di hai. Parivar ka kharcha chalana mushkil ho gaya hai.",
            "Factory thekedaar ne bina notice ke 25 mazdooron ko nikal diya aur gratuity ya PF ka bhugtan nahi kiya.",
            "Overtime kaam karwaya jata hai 14 ghante lekin wages sirf basic 8 ghante ka milta hai."
        ]
    },
    {
        "lang": "te", "lang_name": "Telugu", "urgency": "Medium", "emotion": "frustration",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "Maa aasthini pakkinti vallu anadhikaramga aakramincharu, mandal revenue office lo complaint ichina pattinchukoledhu.",
            "Plot boundary survey kosam 3 sarlu challan kattamu, kani surveyor vachi measure cheyadam ledhu.",
            "Municipal officers illegal drainage connection fix cheyaledhu, varsham vachinappudu illu munigi pothondi."
        ]
    },

    # Low - Neutral & Mild Frustration (Inquiries, Administrative Checks, Noise)
    {
        "lang": "en", "lang_name": "English", "urgency": "Low", "emotion": "neutral",
        "category": "Property Dispute", "dept": "Revenue & Civil Grievance Division",
        "texts": [
            "Request for status update on land mutation tracking application number REV-2025-9018 registered last month.",
            "Clarification required regarding documentation standards for transfer of agricultural patta title deeds.",
            "Public grievance regarding street illumination failure on 4th cross road residential area.",
            "Petition for installing speed calming rumble strips near local primary school crossing junction."
        ]
    },
    {
        "lang": "hi", "lang_name": "Hindi", "urgency": "Low", "emotion": "neutral",
        "category": "Consumer Dispute", "dept": "Consumer Redressal Forum",
        "texts": [
            "Ration card me naam ki spelling sudharne ke liye aavedan kiya tha, uski sthiti ki jankari chahiye.",
            "Bijli meter reading me 100 unit ka antar hai, bill correction ki aupcharik darkhwast hai.",
            "Nagar nigam se park ki safai ke vishay me nivedan patra."
        ]
    },
    {
        "lang": "te", "lang_name": "Telugu", "urgency": "Low", "emotion": "neutral",
        "category": "Consumer Dispute", "dept": "Consumer Redressal Forum",
        "texts": [
            "Water connection application status vivaralu thelusukovadaniki nivedana.",
            "Street light marpudu gurinchi ward sachivalayam lo ichina application number 88219 status.",
            "Aadhaar card address update enquiry kosam darkhasthu."
        ]
    }
]

CITIZEN_NAMES = [
    "Rajesh Sharma", "Ananya Reddy", "Suresh Kumar", "Priya Venkatesh", "Mohammad Farooq",
    "Kavita Verma", "Ramesh Babu", "Sneha Mukherjee", "Vikram Rathore", "Divya Pillai",
    "Arjun Patel", "Bhavani Shankar", "Deepak Gupta", "Meenakshi Sundaram", "Abdul Qadir",
    "Pooja Deshmukh", "Chiranjeevi Rao", "Sunita Yadav", "Karthik Raja", "Shabnam Begum"
]

def generate_seed_data(num_samples=380):
    records = []
    
    for i in range(num_samples):
        tmpl = random.choice(TEMPLATES)
        text = random.choice(tmpl["texts"])
        name = random.choice(CITIZEN_NAMES)
        
        # Slight variation by appending case details
        if random.random() > 0.4:
            details = [
                f" Incident occurred around {random.randint(1,12)} {'AM' if random.random()>0.5 else 'PM'}.",
                f" Reference complaint file ref #TN-{random.randint(1000,9999)}.",
                " Witness statements and digital receipts are ready for formal scrutiny.",
                " Have already sent formal registered speed post notice earlier.",
                f" Loss magnitude estimated at approximate Rs {random.randint(10, 500) * 1000}."
            ]
            text += random.choice(details)

        rec = {
            "id": f"CMP-2026-{1000 + i}",
            "citizen_name": name,
            "citizen_contact": f"+91 {random.randint(9100000000, 9999999999)}",
            "citizen_email": f"{name.lower().replace(' ', '.')}@example.com",
            "raw_text": text,
            "detected_lang": tmpl["lang"],
            "detected_lang_name": tmpl["lang_name"],
            "urgency_label": tmpl["urgency"],
            "emotion_label": tmpl["emotion"],
            "category": tmpl["category"],
            "department_name": tmpl["dept"],
            "status": "Resolved" if i % 4 == 0 else ("Under Review" if i % 3 == 0 else "Submitted")
        }
        records.append(rec)
    
    os.makedirs("c:/NLP-Project/data", exist_ok=True)
    with open("c:/NLP-Project/data/seed_complaints.json", "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {len(records)} sample legal complaints in data/seed_complaints.json")

if __name__ == "__main__":
    generate_seed_data()
