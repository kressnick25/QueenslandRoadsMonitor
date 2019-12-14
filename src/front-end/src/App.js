import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Polar } from "react-chartjs-2";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ReactTable from "react-table";
import Navbar from "react-bootstrap/Navbar";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { unix } from "moment";
import "./App.css";
import "react-table/react-table.css";

const serverEndpoint =
  "http://ec2-3-106-127-14.ap-southeast-2.compute.amazonaws.com/api";

function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function FetchProcessEndpoint(urls, setError) {
  fetch(serverEndpoint + "/process", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ urls: urls })
  })
    .then(res => {
      console.log(res);
      console.log(urls);
      setError(false);
    })
    .catch(err => {
      console.log(err)
      setError(true);
    });
}

export function App() {
  const [doughnutdata, setDoughnutData] = useState([]);
  const [tabledata, setTableData] = useState([]);
  const [timestamp, setTimestamp] = useState();
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    setInterval(() => {
      let doughnutData = {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: "#fc3d39",
            hoverBackgroundColor: getRandomColor()
          }
        ]
      };
      let tableData = [];
      let urlsList = [];
      fetch(serverEndpoint + "/list")
        .then(res => res.json())
        .then(body => {
          body.features.forEach(feature =>
            urlsList.push(feature.properties.image_url)
          );
          fetch(serverEndpoint + "/latest")
            .then(res => res.json())
            .then(res => {
              // Compare data from our api with traffic api to get location name
              res.locations.forEach(url => {
                for (let location of body.features) {
                  if (location.properties.image_url === url.url) {
                    // Format Data for table
                    tableData.push({
                      location: location.properties.description,
                      count: url.count
                    });
                    //Format data for graph
                    doughnutData.labels.push(location.properties.description);
                    doughnutData.datasets[0].data.push(url.count);
                    break; // dont process rest
                  }
                }
              });
              setTableData(tableData);
              setDoughnutData(doughnutData);
              setTimestamp(res.timestamp);
              setUrls(urlsList);
              setLoading(false);
            })
            .catch(err => {
              console.log(err);
              setError(true);
            });
        })
        .catch(err => {
          console.log(err);
          setError(true);
        });
    }, 5000); // refresh delay
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <Nav
          urls={urls}
          timestamp={timestamp}
          FetchProcessEndpoint={FetchProcessEndpoint}
          Loading={loading}
          setError={setError}
          error={error}
        />
        {loading ? (
          <Spinner animation="border" hidden={error} />
        ) : (
          <Body tabledata={tabledata} doughnutdata={doughnutdata} />
        )}
        {error ? <h1>Sorry! Something has gone wrong...</h1> : <></>}
      </header>
    </div>
  );
}

const Nav = props => {
  return (
    <Navbar className="App-navbar" expand="lg" fixed="top">
      <Navbar.Brand>
        <h1 className="App-navbar-brand">Queensland Roads Monitor</h1>
      </Navbar.Brand>
      {!props.error && <Button
        variant="outline-primary"
        onClick={event => props.FetchProcessEndpoint(props.urls, props.setError)}
      >
        Fetch Data
      </Button>}
      {props.error && <Button
        variant="outline-danger"
        onClick={event => props.FetchProcessEndpoint(props.urls, props.setError)}
      >
        Error
      </Button>}
      <h3 className="App-navbar-unixtime">
        Last updated: {props.Loading ? <>Loading...</>: unix(props.timestamp).format("MMM Do YYYY, HH:mm")}
      </h3>
    </Navbar>
  );
};

const Body = props => {
  return (
    <Container>
      <Row s>
        <Col
          className="table-col"
          xs="auto"
          sm="auto"
          md="auto"
          lg="auto"
          xl="auto"
        >
          <ReactTable
            data={props.tabledata}
            noDataText="No entries found."
            columns={[
              {
                Header: "Location",
                accessor: "location",
                minWidth: 480
              },
              {
                Header: "Car Count",
                accessor: "count",
                minWidth: 120
              }
            ]}
            defaultPageSize={7}
            className="-striped -highlight"
            showPageSizeOptions={false}
          />
        </Col>
        <Col
          className="polar-col"
          xs="auto"
          sm="auto"
          md="auto"
          lg="auto"
          xl="auto"
        >
          <Polar
            data={props.doughnutdata}
            width={400}
            height={400}
            options={{ maintainAspectRatio: false, legend: false }}
          />
        </Col>
      </Row>
    </Container>
  );
};

export default App;
