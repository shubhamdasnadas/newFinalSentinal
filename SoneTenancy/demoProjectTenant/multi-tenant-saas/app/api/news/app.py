from newsapi import NewsApiClient
from datetime import date, timedelta
# Init
newsapi = NewsApiClient(api_key='981528e4e3a34c8c87b32c95fa0e3edb')


today = str(date.today())
last_week = today - timedelta(days=7)
# /v2/everything
all_articles = newsapi.get_everything(q='cybersecurity',
                                      from_param=today,
                                      to=last_week,
                                      language='en',
                                      sort_by='relevancy',
                                      page=2)

print("======================== ALL ARTICLES ========================== \n", all_articles)

