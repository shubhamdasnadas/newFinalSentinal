from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from newsapi import NewsApiClient
from datetime import date, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

newsapi = NewsApiClient(api_key='981528e4e3a34c8c87b32c95fa0e3edb')


@app.get("/news")
def get_news(q: str = "cybersecurity", page: int = 1, page_size: int = 20):
    today = date.today()
    from_date = str(today - timedelta(days=7))
    to_date = str(today)

    try:
        response = newsapi.get_everything(
            q=q,
            from_param=from_date,
            to=to_date,
            language='en',
            sort_by='relevancy',
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": response.get("status"),
        "totalResults": response.get("totalResults", 0),
        "articles": response.get("articles", []),
    }
