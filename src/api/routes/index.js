var express = require('express');
var router = express.Router();

const redis = require("redis"),
  client = redis.createClient({host: 'vehiclecounter.x9mnoc.0001.apse2.cache.amazonaws.com', port: '6379'});
const fetch = require('node-fetch');
const moment = require('moment');
const AWS = require('aws-sdk');

// AWS.config.update({
// 	region: "ap-southeast-2"
// });

AWS.config.loadFromPath('./aws-config.json');

let db = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

function getDdbItem (key) {
  const params = {
    TableName: 'trafficCounts',
    Key: {
      'timestamp': {N: key.toString()}
    }
  }
  
  db.get(params, (err, data) => {
    if (err){
      return null;
    } else {
      return data.item;
    }
  });
}

/* Get traffic updates for a specific list of locations*/
// Take an array of image urls and send to redis
router.post('/api/process', (req, res, next) => {
  // get array from url
  let image_urls = [];
  try {
    image_urls = req.body.urls;
  } catch (e) {
    res.status(400);
    res.json({"Error": "Bad request format"})
    return;
  }
  const minute = (Math.round(moment(Date.now()).unix() / 60) * 60);
  const storedItems = getDdbItem(minute);

  image_urls.forEach((url) =>{
    if(storedItems != undefined) {
      if (storedItems[url] == null){
        // push to redis
        client.set(url, minute.toString(), redis.print);
      }
    } else {
      client.set(url, minute.toString(), redis.print);
    }
  });

  res.status(200);
  res.send("OK");
});

/* Retreive all counts for last n items */
router.get('/api/latest', (req, res, next ) => {
  let params = {
    TableName: 'trafficCounts',
  }

  db.scan(params, (err, data) => {
      if (err) {
        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500);
        res.send("Scan error")
      } else {
          let latest = data.Items[0];    
          data.Items.forEach((itemdata) => {
            if (itemdata.timestamp > latest.timestamp) {
              latest = itemdata;
            }
          });
          
          let timestamp = latest["timestamp"];
          delete latest["timestamp"];
          let locations = [];
          for (let key in latest) {
            locations.push({
              url: key,
              count : latest[key]
            });
          }
          
          let out = {
            "timestamp" : timestamp,
            "locations": locations
          }
          res.status(200);
          res.json(out);
      }
    });
});

router.get('/api/process-test', function(req, res, next) {
  fetch('https://api.qldtraffic.qld.gov.au/v1/webcams')
    .then(res => res.json())
    .then((body) => {
      let image_urls = body.features;
      image_urls.forEach(item => {
        let url = item.properties.image_url;
        var minute = (Math.round(moment(Date.now()).unix() / 60) * 60);
        client.set(url, minute.toString(), redis.print);
      });
      res.status(200);
      res.send('OK');
    })
});

// Forward list form qldTrafficApi
router.get('/api/list', function(req, res, next) {
  fetch('https://api.qldtraffic.qld.gov.au/v1/webcams')
    .then(res => res.json())
    .then((body) => res.json(body))
});

// /* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'Express' });
// });


module.exports = router;
