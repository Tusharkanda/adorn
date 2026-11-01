from fastapi import FastAPI

from app.routers import jobs, models, products

app = FastAPI(title="Adorn API")

app.include_router(products.router)
app.include_router(models.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
