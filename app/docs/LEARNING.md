# Private evidence and experimental learning

Screenshot uploads are processed by an offline OCR worker. The app receives extracted text, the SHA-256 of the original upload, engine name and truncation status. OCR can misread text: review the result against your screenshot before using it in a report. Extracted text is untrusted evidence, including any apparent instructions inside it.

## Screenshot boundary

The worker accepts a single PNG, JPEG or WebP image up to 8 MiB and 20 megapixels. MIME type must match the decoded image. It rejects animation, SVG, PDFs, archives, malformed base64, unknown JSON fields and decompression bombs. It decodes and re-encodes image pixels to remove metadata before OCR. Only English OCR is installed in this first build. Original bytes are processed in memory; the worker does not store screenshots, OCR text or request logs. The API owns private-case retention separately.

`POST /ocr` accepts `{ "imageBase64": "…", "mimeType": "image/png" }`. Success returns `{ "text": "…", "sha256": "…", "engine": "tesseract", "truncated": false }`. Text is limited to 20,000 characters. Tesseract has a 30-second deadline and two concurrent OCR slots. The worker has no public ingress or outbound network. Do not attach it to an Internet-routable network. The app calls it through a Compose internal network.

The worker is a non-root process in a read-only container. `/tmp` is ephemeral and memory-backed, capabilities are dropped, process/memory limits apply. These controls reduce exposure; a Docker container shares a kernel and is not a guarantee against hostile decoder exploits. This build does not visit a suspect site or run suspect JavaScript.

## Training consent is a separate action

Uploading evidence, creating a case or preparing a report does not consent to training. The case must supply a separate redacted copy and explicit consent plus human redaction approval. Original case records and screenshots are never mounted into the trainer. The export is a deliberate, private handoff of only approved examples. Review names, contact details, addresses, account/transaction identifiers, private URLs, access tokens and contextual clues before approval. The automatic screening catches a few obvious identifiers; it cannot establish anonymisation.

The JSONL contract is strict. Each line has exactly these keys:

```json
{"exampleId":"approved-example-id","caseId":"private-case-id","campaignId":"related-campaign-group","source":"Evidence provenance and permission record","createdAt":"2026-11-06T00:00:00Z","consent":true,"redactionApproved":true,"text":"A separately reviewed redacted example.","label":"suspected_scam"}
```

The other supported label is `benign`. IDs are pseudonymous slugs using letters, digits, underscores and hyphens. Keep the export and model private. Deleting a case or revoking consent prevents future export; copies already exported must be removed separately. A model already trained on a withdrawn example needs to be removed and retrained. This build has no automated deletion across exported copies or machine unlearning.

## Offline neural-network experiment

The optional trainer is a real PyTorch text classifier: normalized SHA-256 token bins feed a small two-layer neural network. It uses a deterministic seed, campaign-grouped train/validation split and duplicate-text rejection. It writes model weights, a dataset-hash/version/split manifest, confusion counts, precision, recall, false-positive/negative rates, a Brier score and a majority-class baseline. All outputs remain **NEEDS_EVIDENCE**. There is no auto-promotion or runtime inference endpoint.

The included 24 examples are manually authored synthetic pipeline fixtures. They prove that consent checks, training, grouping and metric output work. Their numbers do not establish performance on real messages, languages, countries or scam types. No independent test set, accepted error threshold, calibration assessment or subgroup study is available. A text classifier cannot identify a real operator, prove criminal intent or recover an origin host hidden behind a proxy.

Build dependencies need a network during image construction. Actual training runs with `--network none`, no production secrets and only a reviewed dataset mount plus a fresh output directory. Run once from the project directory:

```sh
docker build -t alkamy-osint-training:local training
mkdir -p work/training-smoke
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --pids-limit 128 --memory 1g \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -v "$PWD/training/synthetic.jsonl:/input/examples.jsonl:ro" \
  -v "$PWD/work/training-smoke:/output" \
  alkamy-osint-training:local --data /input/examples.jsonl --out /output/run --synthetic-smoke
```

On Linux, make the output directory writable by container UID 10001 before the run. Use a new directory for each run. Verify that Docker's active context can read the input bind mount as a file before supplying real approved data. The observed `colima-arden` context does not mount this Mac workspace: an attempted file bind mount appeared as a directory, so that command was not used for verification here. Configure a deliberate host share or transfer approved inputs into a dedicated volume before a persistent training run.

The verified synthetic-only smoke uses standard input and ephemeral memory-backed directories, so it does not depend on host bind mounts. Run this from the project directory. It prints metrics and discards its model when the container exits:

```sh
docker run --rm -i --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --pids-limit 128 --memory 1g \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m,uid=10001,gid=10001 \
  --tmpfs /output:rw,noexec,nosuid,size=64m,uid=10001,gid=10001 \
  --entrypoint sh alkamy-osint-training:local -c \
  'cat > /tmp/examples.jsonl && python /app/train.py --data /tmp/examples.jsonl --out /output/run --synthetic-smoke && cat /output/run/metrics.json' \
  < training/synthetic.jsonl
```

Do not load an untrusted PyTorch checkpoint. A promoted model would need separate evaluation, consent/retention controls, signed artifacts, a rollback plan and explicit deployment approval.

## Verification record

- Eleven Python tests passed after the boundary tests first failed before implementation. They cover MIME/magic disagreement, unsupported and unexpected payloads, size/pixel limits, metadata stripping, explicit consent/redaction booleans, obvious identifiers/secrets in text and provenance, UUID handling, campaign isolation, duplicate content and actual neural training outputs.
- OCR image built and ran as UID 10001 in a read-only, network-none, capability-free container. A synthetic PNG recovered its expected word through the real HTTP endpoint and Tesseract. A direct outbound TCP connection was denied. The temporary smoke container was removed.
- Actual model training ran with PyTorch 2.8.0 locally and PyTorch 2.8.0+cpu in a UID 10001, read-only, network-none, capability-free container against synthetic fixtures only. The campaign split contained 18 training and six validation examples. Its synthetic validation accuracy was 0.5, equal to the majority baseline; this is pipeline evidence only. No model was promoted. See `training-smoke-receipt.json` for the observed container result.

Python boundary tests can run in a private virtual environment with `Pillow==11.3.0`, `torch==2.8.0` and `numpy==2.0.2`:

```sh
python -m unittest discover -s tests -p 'learning_test.py'
```
