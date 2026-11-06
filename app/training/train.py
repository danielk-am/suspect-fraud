"""Offline experimental text neural network. Never publishes or promotes a model."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

from data import LABELS, load_records, split_by_campaign


def features(rows, torch):
    result = torch.zeros((len(rows), 256), dtype=torch.float32)
    for i, row in enumerate(rows):
        words = re.findall(r'[a-z]{2,}', row['text'].lower())[:4000]
        for word in words:
            j = int.from_bytes(hashlib.sha256(word.encode()).digest()[:4], 'big') % 256
            result[i, j] += 1
        norm = result[i].sum()
        if norm > 0:
            result[i] /= norm
    return result


def evaluate(model, rows, torch):
    with torch.no_grad():
        probabilities = torch.softmax(model(features(rows, torch)), dim=1)[:, 1]
    truth = [LABELS[r['label']] for r in rows]
    predictions = [int(p >= .5) for p in probabilities.tolist()]
    counts = {'tp': 0, 'fp': 0, 'tn': 0, 'fn': 0}
    for y, predicted in zip(truth, predictions):
        counts[{(1, 1): 'tp', (0, 1): 'fp', (0, 0): 'tn', (1, 0): 'fn'}[(y, predicted)]] += 1
    def ratio(top, bottom):
        return top / bottom if bottom else None
    return {
        'count': len(rows), 'confusion': counts,
        'precision': ratio(counts['tp'], counts['tp'] + counts['fp']),
        'recall': ratio(counts['tp'], counts['tp'] + counts['fn']),
        'falsePositiveRate': ratio(counts['fp'], counts['fp'] + counts['tn']),
        'falseNegativeRate': ratio(counts['fn'], counts['fn'] + counts['tp']),
        'brierScore': sum((p-y)**2 for p, y in zip(probabilities.tolist(), truth)) / len(rows),
        'accuracy': (counts['tp'] + counts['tn']) / len(rows),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--synthetic-smoke', action='store_true', help='Mark this run as synthetic pipeline verification only.')
    args = parser.parse_args()
    records = load_records(args.data)
    train, valid = split_by_campaign(records, seed=17)
    if len(records) < 16 or any({r['label'] for r in rows} != set(LABELS) for rows in [train, valid]):
        raise ValueError('Need 16 or more records and both labels in training and validation.')
    import torch
    torch.manual_seed(17)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    model = torch.nn.Sequential(torch.nn.Linear(256, 16), torch.nn.ReLU(), torch.nn.Linear(16, 2))
    x = features(train, torch)
    y = torch.tensor([LABELS[r['label']] for r in train], dtype=torch.long)
    optimizer = torch.optim.Adam(model.parameters(), lr=.02)
    for _ in range(80):
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(model(x), y)
        loss.backward()
        optimizer.step()
    model.eval()
    validation = evaluate(model, valid, torch)
    positives = sum(LABELS[r['label']] for r in train)
    baseline_class = int(positives >= len(train) / 2)
    manifest = {
        'evaluationStatus': 'NEEDS_EVIDENCE',
        'syntheticSmokeOnly': args.synthetic_smoke,
        'datasetSha256': hashlib.sha256(args.data.read_bytes()).hexdigest(),
        'seed': 17, 'torchVersion': torch.__version__, 'modelRevision': 'hashed-256-mlp16-v1',
        'preprocessing': 'English alphabetic tokens; SHA-256 256-bin counts normalized per document; first 4000 tokens',
        'split': {'unit': 'campaignId', 'trainingCount': len(train), 'validationCount': len(valid), 'trainingCampaigns': sorted({r['campaignId'] for r in train}), 'validationCampaigns': sorted({r['campaignId'] for r in valid})},
        'validation': validation,
        'baseline': {'kind': 'training majority class', 'validationAccuracy': sum(LABELS[r['label']] == baseline_class for r in valid) / len(valid)},
        'limitations': ['Experimental; thresholds and error budgets have not been accepted.', 'No independently held-out test set or representative real-world evaluation.', 'Validation numbers describe this supplied dataset only; synthetic smoke results say nothing about scam-detection reliability.', 'Uncalibrated probabilities; small-sample uncertainty and subgroup performance are unknown.', 'English text only; cannot establish identity, hosting origin, criminality or intent.', 'Opt-in and automated checks cannot guarantee complete anonymisation; human redaction review is required.', 'Weights may retain information. Consent withdrawal requires removal and retraining; no automatic model promotion.'],
    }
    args.out.mkdir(parents=True, exist_ok=True)
    # A completed artifact is renamed atomically. Do not overwrite a previous run.
    for name in ['model.pt', 'metrics.json', 'MODEL-CARD.md']:
        if (args.out / name).exists():
            raise ValueError('Use a fresh output directory for every run.')
    with tempfile.TemporaryDirectory(dir=args.out) as staging:
        staging = Path(staging)
        torch.save({'state_dict': model.state_dict(), 'revision': manifest['modelRevision'], 'labels': LABELS, 'datasetSha256': manifest['datasetSha256']}, staging / 'model.pt')
        (staging / 'metrics.json').write_text(json.dumps(manifest, indent=2) + '\n')
        (staging / 'MODEL-CARD.md').write_text('# Experimental SuspectFraud text classifier\n\nStatus: NEEDS_EVIDENCE. This run is not approved for decisions or public use.\n\n' + '\n'.join('- ' + line for line in manifest['limitations']) + '\n\nSee metrics.json for dataset hash, split, versions, baseline and metric denominators.\n')
        for name in ['model.pt', 'metrics.json', 'MODEL-CARD.md']:
            os.replace(staging / name, args.out / name)
    print(json.dumps({'status': 'trained_experiment', 'evaluationStatus': 'NEEDS_EVIDENCE', 'trainingCount': len(train), 'validationCount': len(valid), 'modelPromoted': False}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f'Training refused: {exc}')
