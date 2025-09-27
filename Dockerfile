FROM python:3.11-slim
WORKDIR /app
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ ./server/
COPY server/static ./server/static
EXPOSE 8000
CMD ["python", "server/main.py"]
