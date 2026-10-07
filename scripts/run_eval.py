import os
import sys
import json

# Add backend directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.evaluator import evaluator_service

def main():
    print("=" * 70)
    print("LEGAL COMPLAINT CLASSIFIER - BENCHMARK EVALUATION SUITE")
    print("=" * 70)
    print("Running evaluation across 50 ground-truth multilingual benchmark cases...")
    
    metrics = evaluator_service.evaluate_model()
    
    print("\nOVERALL METRICS:")
    print(f"- Total Ground Truth Samples: {metrics['total_samples']}")
    print(f"- Emotion Classification Accuracy: {metrics['emotion_accuracy']}%")
    print(f"- Emotion Macro-F1 Score:         {metrics['emotion_f1_macro']}")
    print(f"- Urgency Classification Accuracy: {metrics['urgency_accuracy']}%")
    print(f"- Urgency Macro-F1 Score:         {metrics['urgency_f1_macro']}")
    print(f"- Category Routing Accuracy:      {metrics['category_accuracy']}%")

    print("\nCONFUSION MATRIX (URGENCY):")
    labels = metrics['confusion_matrix_urgency']['labels']
    print(f"{'True \\ Pred':<15}" + "".join([f"{l:<12}" for l in labels]))
    for idx, row in enumerate(metrics['confusion_matrix_urgency']['matrix']):
        row_str = "".join([f"{val:<12}" for val in row])
        print(f"{labels[idx]:<15}{row_str}")

    print("\nPER-LANGUAGE PERFORMANCE:")
    for lang, scores in metrics['per_language_accuracy'].items():
        print(f"- [{lang.upper()}] Samples: {scores['total']}, Urgency Acc: {scores['urgency_accuracy']}%, Emotion Acc: {scores['emotion_accuracy']}%")

    print("\n" + "=" * 70)
    print("Evaluation benchmark completed successfully. Ready for academic viva.")
    print("=" * 70)

if __name__ == "__main__":
    main()
