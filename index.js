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
        this.endpoint = "http://88.198.184.76/api/devices";
    }

    this.deviceId = config["deviceId"];
    if (!this.deviceId) {
        throw new Error("Missed param deviceId");
    }

    this.info = new Service.AccessoryInformation();
    this.info
        .setCharacteristic(Characteristic.Manufacturer, "Airoom")
        .setCharacteristic(Characteristic.Model, "1.0");

    // Create services
    this.service = new Service.TemperatureSensor(this.name);
    this.service.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.service.addCharacteristic(Characteristic.CarbonDioxideLevel);
    this.service.addCharacteristic(Characteristic.AirPressure);

    // Update states first time
    this.UpdateStates;

    // Set interval
    var self = this;
    setInterval(function () {
        self.UpdateStates();
    }, 10000);
}


Airoom.prototype.UpdateStates = function () {
    this.log("Getting states...");

    request.get({
        url: this.endpoint + "/" + this.deviceId
    }, function (err, response, body) {

        if (!err && response.statusCode === 200) {

            // Log body
            this.log("State is %s", body);

            var json = JSON.parse(body);

            // Set states
            var temp = json.state.payload.temperature;
            var humidity = json.state.payload.humidity;
            var pressure = json.state.payload.pressure;
            var co2 = json.state.payload.co2;

            // Set current states
            this.service.setCharacteristic(Characteristic.CurrentTemperature, temp);
            this.service.setCharacteristic(Characteristic.CurrentRelativeHumidity, humidity);
            this.service.setCharacteristic(Characteristic.CarbonDioxideLevel, co2);
            this.service.setCharacteristic(Characteristic.AirPressure, pressure * 0.00750062);

            // Accessory Information
            this.info.setCharacteristic(Characteristic.SerialNumber, json.mac);
        }
        else {

            this.log("Error '%s' getting state. Response: %s", err, body);
        }

    }.bind(this));
};

Airoom.prototype.getServices = function () {
    return [this.info, this.service];
};