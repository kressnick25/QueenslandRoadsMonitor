# USAGE
# python yolo.py --image images/baggage_claim.jpg --yolo yolo-coco

# import the necessary packages
import numpy as np
import time
import cv2
import os
import urllib.request as urllib
import redis
import time
import boto3

os.environ['AWS_DEFAULT_REGION'] = 'ap-southeast-2'

#connect to stores
# dynamodb
dynamo = boto3.resource('dynamodb',
    aws_access_key_id='AKIAYLIZ3EBVQEKYUDVX',
    aws_secret_access_key='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'
)
DB = dynamo.Table('trafficCounts')

# REDIS
REDIS = redis.Redis(host='vehiclecounter.x9mnoc.0001.apse2.cache.amazonaws.com', port=6379, db=0)

 # load the COCO class labels our YOLO model was trained on
# labelsPath = "yolo-coco/coco.names"
LABELS = open(os.path.join("yolo-coco/coco.names")).read().strip().split("\n")

# initialize a list of colors to represent each possible class label
np.random.seed(42)

# load our YOLO object detector trained on COCO dataset (80 classes)
net = cv2.dnn.readNetFromDarknet(os.path.join("yolo-coco/yolov3.cfg"), os.path.join("yolo-coco/yolov3.weights"))

# determine only the *output* layer names that we need from YOLO
ln = net.getLayerNames()
ln = [ln[i[0] - 1] for i in net.getUnconnectedOutLayers()]

# download the image, convert it to a NumPy array, and then read
# it into OpenCV format
def url_to_image(url):
    # fake user agent so not blocked by remote server
    req = urllib.Request(url, headers={'User-Agent':"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"})
    resp = urllib.urlopen( req )
    image = np.asarray(bytearray(resp.read()), dtype="uint8")
    image = cv2.imdecode(image, cv2.IMREAD_COLOR)
    # return the image
    return image

###########################################
# Title: YOLO object detection with OpenCV
# Author: Adrian Rosebrock
# Date: November 12, 2018
# Availability: https://www.pyimagesearch.com/2018/11/12/yolo-object-detection-with-opencv/
##########################################
def count_vehicles_in_image(image):
    global LABELS, net, ln

    # load our input image and grab its spatial dimensions
    (H, W) = image.shape[:2]

    # construct a blob from the input image and then perform a forward
    # pass of the YOLO object detector, giving us our bounding boxes and
    # associated probabilities
    blob = cv2.dnn.blobFromImage(image, 1 / 255.0, (416, 416),
        swapRB=True, crop=False)
    net.setInput(blob)
    start = time.time()
    layerOutputs = net.forward(ln)
    end = time.time()

    # show timing information on YOLO
    print("[INFO] YOLO took {:.6f} seconds".format(end - start))

    # initialize our lists of detected bounding boxes, confidences, and
    # class IDs, respectively
    boxes = []
    confidences = []
    classIDs = []

    # loop over each of the layer outputs
    for output in layerOutputs:
        # loop over each of the detections
        for detection in output:
        # extract the class ID and confidence (i.e., probability) of
        # the current object detection
            scores = detection[5:]
            classID = np.argmax(scores)
            confidence = scores[classID]
            # filter out weak predictions by ensuring the detected
            # probability is greater than the minimum probability
            if confidence > 0.5: # CONFIDENCE VAR
                # scale the bounding box coordinates back relative to the
            # size of the image, keeping in mind that YOLO actually
            # returns the center (x, y)-coordinates of the bounding
            # box followed by the boxes' width and height
                box = detection[0:4] * np.array([W, H, W, H])
                (centerX, centerY, width, height) = box.astype("int")
            # use the center (x, y)-coordinates to derive the top and
            # and left corner of the bounding box
                x = int(centerX - (width / 2))
                y = int(centerY - (height / 2))
                # update our list of bounding box coordinates, confidences,
                # and class IDs
                boxes.append([x, y, int(width), int(height)])
                confidences.append(float(confidence))
                classIDs.append(classID)

    # apply non-maxima suppression to suppress weak, overlapping bounding
    # boxes
    idxs = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.3) # CONFIDENCE, THRESHOLD
############ END CITATION ##############

    vehicle_count = 0
    # ensure at least one detection exists
    if len(idxs) > 0:
        # loop over the indexes we are keeping
        for i in idxs.flatten():
            if LABELS[classIDs[i]] in ["motorbike", "car", "bus", "truck"]:
                vehicle_count += 1

    return vehicle_count

def update_db(key, url, count):
    response = DB.update_item(
        Key={'timestamp': int(key)},
        AttributeUpdates={
            url : {
                'Value' : count,
                'Action' : 'ADD'
            }
        }
)

def update_map (key, url, count):
    response = DB.update_item(
        Key = {'timestamp': int(key)},
        UpdateExpression = "ADD Locations :c",
        ExpressionAttributeValues= {":c": {"M": {"Key": "https", "Value": "Yes"} } },
        ReturnValues= "ALL_NEW"

    )
while True:
    # working state
    print("Entering running state:")
    c = 0
    while (REDIS.dbsize() != 0):
        try:
            key = REDIS.randomkey()
            url = key.decode('utf-8')
            minute = REDIS.get(key).decode('utf-8')
            image = url_to_image(url)
            count = count_vehicles_in_image(image)
            print("count: ", count)
            ## send to dynamo
            update_db(minute, url, count)
            c += 1
            REDIS.delete(key)
        except Exception as e:
            print(e)
            

    ## send to db
    print("records process: ", c)
    # listening state
    print("Entering listening state:")
    listen = True
    while(listen):
        time.sleep(0.5)
        for key in REDIS.scan_iter('*'):
            if REDIS.dbsize != 0:
                listen = False


# send to db


image = url_to_image("https://webcams.qldtraffic.qld.gov.au/Sunshine_Coast/caboolture_river.jpg")
vehicle_count = count(image)

print("number of vehicles detected ", vehicle_count)