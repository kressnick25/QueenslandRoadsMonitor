FROM jjanzic/docker-python3-opencv:latest
COPY ./.aws .
COPY ./main.py .
COPY ./app .
COPY ./requirements.txt .
COPY ./yolo-coco ./yolo-coco
RUN pip install -r requirements.txt
ENTRYPOINT [ "python" ]
CMD ["app", "main.py"]