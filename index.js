var request = require("request");
const inherits = require('util').inherits;
var Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;


    // Custom characteristic Air pressure
    Characteristic.AirPressure = function () {
        Characteristic.call(this, 'Air Pressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "hPa",
            maxValue: 1100,
            minValue: 700,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(Characteristic.AirPressure, Characteristic);
    Characteristic.AirPressure.UUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';


    homebridge.registerAccessory("homebridge-airoom", "Airoom", Airoom);
};

function Airoom(log, config) {

    this.log = log;
    this.name = config["name"];

    this.endpoint = config["endpoint"];
    if (!this.endpoint) {
        this.endpoint = "https://airoom.cloud/api/devices";
    }

    this.deviceId = config["deviceId"];
    if (!this.deviceId) {
        throw new Error("Missed param deviceId");
    }

    // Declare services
    this.services = [];

    // Get the mac address
    try {
        var mac = this.getSerialNumber();
    } catch (e) {
        mac = "Unknown";
    }

    // Get Accessory Information
    this.info = new Service.AccessoryInformation();
    this.info.setCharacteristic(Characteristic.Model, "1.0");
    this.info.setCharacteristic(Characteristic.Manufacturer, "Airoom");
    this.info.setCharacteristic(Characteristic.FirmwareRevision, "1.0");
    this.info.setCharacteristic(Characteristic.SerialNumber, mac);
    this.services.push(this.info);

    // Create services
    this.sensor = new Service.TemperatureSensor(this.name);
    this.sensor.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.sensor.addCharacteristic(Characteristic.CarbonDioxideLevel);
    this.sensor.addCharacteristic(Characteristic.AirPressure);
    this.services.push(this.sensor);

    // Update states first time
    try {
        this.UpdateStates;
    } catch (e) {
        this.log("Error '%s' getting state.", e);
    }

    // Set interval
    var self = this;
    setInterval(function () {

        try {
            self.UpdateStates();
        } catch (e) {
            self.log("Error '%s' getting state.", e);
        }

    }, 10000);
}


Airoom.prototype.UpdateStates = function () {

    var self = this;

    this.getInfo(function (err, temp, humidity, pressure, co2, mac) {

        if (err == null) {
            // Set current states
            self.sensor.setCharacteristic(Characteristic.CurrentTemperature, temp);
            self.sensor.setCharacteristic(Characteristic.CurrentRelativeHumidity, humidity);
            self.sensor.setCharacteristic(Characteristic.CarbonDioxideLevel, co2);
            self.sensor.setCharacteristic(Characteristic.AirPressure, pressure);
        } else {
            throw err;
        }

    });

};

Airoom.prototype.getSerialNumber = function () {
    var req = require('sync-request');
    var url = this.endpoint + "/" + this.deviceId;
    var res = req('GET', url, {
        timeout: 2000,
        socketTimeout: 2000,
    });

    if (res.statusCode >= 300) {
        var err = new Error(
            'Server responded with status code ' +
            res.statusCode +
            ':\n' +
            res.body.toString(encoding)
        );
        err.statusCode = res.statusCode;
        err.headers = res.headers;
        err.body = res.body;
        throw err;
    }

    var json = JSON.parse(res.body.toString('utf-8'));
    var mac = json.mac;
    return mac
};

Airoom.prototype.getInfo = function (callback) {

    request.get({

        url: this.endpoint + "/" + this.deviceId,

    }, function (err, response, body) {

        if (!err && response.statusCode === 200) {

            var json = JSON.parse(body);

            // Set states
            var temp = json.state.payload.temperature;
            var humidity = json.state.payload.humidity;
            var pressure = json.state.payload.pressure * 0.00750062;
            var co2 = json.state.payload.co2;
            var mac = json.mac;

            callback(null, temp, humidity, pressure, co2, mac);
        } else {
            callback(err);
        }

    }.bind(this));
};

Airoom.prototype.getServices = function () {
    return this.services;
};