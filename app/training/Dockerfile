FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu -r requirements.txt && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin trainer
RUN pip install --no-cache-dir numpy==2.0.2
COPY data.py train.py ./
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
ENTRYPOINT ["python", "train.py"]
