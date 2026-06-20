# Tech Stack — The Indian Insite

## Backend
- **Language**: Python 3.12
- **Framework**: FastAPI
- **Task Queue**: Redis Streams + Celery
- **Database**: PostgreSQL + pgvector
- **Embeddings**: Sentence-Transformers (`all-mpnet-base-v2`)
- **NLP**: spaCy (NER: PERSON, ORG, GPE), optional RoBERTa frame classifier
- **Scraping**: custom http_client + renderer (handles JS-rendered pages)
- **Crypto**: raw HTML is encrypted at rest (see normalizer.py)

## Frontend
- React + Tailwind CSS
- Not yet implemented

## Infrastructure
- Docker + docker-compose (PostgreSQL + Redis locally)
- Nginx (production)
- Prometheus + Grafana (monitoring)
- Sentry (error tracking)

## Key Libraries (from requirements.txt)
- scraping, NLP, crypto, ML stack — see requirements.txt for pinned versions

## Constraints
- pgvector is used for similarity search — do not introduce a separate vector DB
- Redis Streams (not Celery alone) is the ingestion bus — preserve stream semantics
- all-mpnet-base-v2 is the fixed embedding model for MVP — do not swap without a migration plan
