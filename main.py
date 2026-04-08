from fastapi import FastAPI
from day1_core import run_full_simulation

app = FastAPI()

@app.get("/")
def home():
    return {"message": "ORDERLY API is running 🚀"}

@app.get("/run")
def run(n: int = 50):
    return run_full_simulation(n)



from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)