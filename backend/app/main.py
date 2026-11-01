from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import jobs, models, products

app = FastAPI(title="Adorn API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(models.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
