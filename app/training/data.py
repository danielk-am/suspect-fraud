"""Explicitly approved redacted data only; never reads the private case database."""
import datetime
import hashlib
import json
import random
import re

FIELDS = {'exampleId', 'caseId', 'campaignId', 'source', 'createdAt', 'consent', 'redactionApproved', 'text', 'label'}
LABELS = {'benign': 0, 'suspected_scam': 1}
SENSITIVE = re.compile(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|\b(?:password|api[_ -]?key|token|otp)\s*[:=]\s*\S+', re.I)


def validate_record(row):
    if not isinstance(row, dict) or set(row) != FIELDS:
        raise ValueError('Training record has missing or unexpected fields.')
    if row['consent'] is not True or row['redactionApproved'] is not True:
        raise ValueError('Explicit training consent and redaction approval are required.')
    for key in ['exampleId', 'caseId', 'campaignId', 'source']:
        if not isinstance(row[key], str) or not row[key].strip() or len(row[key]) > 200 or any(ord(c) < 32 for c in row[key]):
            raise ValueError('Training provenance is invalid.')
        if key == 'source':
            sensitive = SENSITIVE.search(row[key])
        else:
            # Numeric UUID/hash substrings are not telephone numbers.
            sensitive = not re.fullmatch(r'[A-Za-z0-9_-]+', row[key]) or re.fullmatch(r'\d{8,}', row[key])
        if sensitive:
            raise ValueError('Training provenance needs non-sensitive pseudonymous IDs and source.')
    if not isinstance(row['text'], str) or not 10 <= len(row['text']) <= 20000 or SENSITIVE.search(row['text']):
        raise ValueError('Training text is invalid or contains an obvious sensitive identifier. Review redaction.')
    if not isinstance(row['label'], str) or row['label'] not in LABELS:
        raise ValueError('Unknown training label.')
    try:
        if not isinstance(row['createdAt'], str):
            raise ValueError()
        when = datetime.datetime.fromisoformat(row['createdAt'].replace('Z', '+00:00'))
        if when.tzinfo is None:
            raise ValueError()
    except ValueError as exc:
        raise ValueError('createdAt must be a timezone-aware ISO date.') from exc
    return row


def load_records(path):
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('Dataset exceeds 20 MiB.')
    records = []
    with path.open(encoding='utf-8') as stream:
        for line in stream:
            if line.strip():
                records.append(validate_record(json.loads(line)))
            if len(records) > 10000:
                raise ValueError('Dataset exceeds 10,000 approved records.')
    return records


def split_by_campaign(records, seed=17):
    seen_ids, texts = set(), {}
    for row in records:
        validate_record(row)
        fingerprint = hashlib.sha256(' '.join(row['text'].lower().split()).encode()).hexdigest()
        if row['exampleId'] in seen_ids:
            raise ValueError('Duplicate example ID.')
        if fingerprint in texts:
            raise ValueError('Duplicate text must be removed before splitting.')
        seen_ids.add(row['exampleId'])
        texts[fingerprint] = row['campaignId']
    groups = sorted({r['campaignId'] for r in records})
    if len(groups) < 4:
        raise ValueError('At least four independent campaigns are required.')
    random.Random(seed).shuffle(groups)
    valid_groups = set(groups[:max(1, round(len(groups) * .25))])
    train = [r for r in records if r['campaignId'] not in valid_groups]
    valid = [r for r in records if r['campaignId'] in valid_groups]
    return train, valid
