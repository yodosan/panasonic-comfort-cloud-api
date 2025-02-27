import * as https from "https";
import { RequestOptions } from "https";
import * as url from "url";
import { HttpMethod } from "./models/HttpMethod";
import { OperationMode } from "./models/enums";
import { Device, DeviceParameters, Group, GroupResponse } from "./models/interfaces";
import { LoginRequest } from "./models/LoginRequest";
import { LoginResponse } from "./models/LoginResponse";
import { UpdateResponse } from "./models/UpdateResponse";

export class ComfortCloud {
    private _config = {
        username: "",
        password: "",
        base_url: "https://accsmart.panasonic.com",
        login_url: "/auth/login",
        group_url: "/device/group",
        device_url: "/deviceStatus/{guid}",
        device_now_url: "/deviceStatus/now/{guid}",
        device_control_url: "/deviceStatus/control",
        device_history_url: "/deviceHistoryData",
    };
    private _accessToken: string = "";
    public get token(): string {
        return this._accessToken;
    }
    public set token(value: string) {
        this._accessToken = value;
    }
    private _clientId: string = "";
    public get clientId(): string {
        return this._clientId;
    }
    public set clientId(value: string) {
        this._clientId = value;
    }

    constructor(username: string, password: string) {
        this._config.username = username;
        this._config.password = password;
    }

    /**
     * Login to Panasonic Comfort Cloud
     * @param username Login username
     * @param password Login password
     * @returns LoginResponse containing access token.
     */
    public async login(username: string = this._config.username, password: string = this._config.password): Promise<LoginResponse | undefined> {
        if (!username || !password) throw new Error("Username and password must contain a value.");
        const data = new LoginRequest(username, password);
        const uri = url.parse(`${this._config.base_url}${this._config.login_url}`, true);
        const options: RequestOptions = this.getRequestOptions(HttpMethod.Post, uri);
        const result = await this.request(options, JSON.stringify(data));
        if (result.result === 0) {
            this._accessToken = result.uToken;
            this._clientId = result.clientId;
            return result as LoginResponse;
        }
        return undefined;
    }

    /**
     * Get groups.
     * @returns A list of groups containing list of devices.
     */
    public async getGroups(): Promise<Group[]> {
        const uri = url.parse(`${this._config.base_url}${this._config.group_url}`, true);
        const options: RequestOptions = this.getRequestOptions(HttpMethod.Get, uri);
        const result = await this.request(options);
        if (result.iaqStatus.statusCode === 200) {
            const data = result as GroupResponse;
            return data.groupList;
        }
        return [] as Group[];
    }

    /**
     * Returns device with the provided Device ID
     * @param deviceId Device ID to use. Aka deviceGuid
     * @returns Device based on deviceId
     */
    public async getDevice(deviceId: string): Promise<Device> {
        const uri = url.parse(`${this._config.base_url}${this._config.device_url.replace("{guid}", deviceId)}`, true);
        const options: RequestOptions = this.getRequestOptions(HttpMethod.Get, uri);
        const result = await this.request(options);
        result.deviceGuid = deviceId;
        return result as Device;
    }

    /**
     * Returns device with the provided Device ID
     * @param deviceId Device ID to use. Aka deviceGuid
     * @returns Device based on deviceId
     */
    public async getDeviceNow(deviceId: string): Promise<Device> {
        const uri = url.parse(`${this._config.base_url}${this._config.device_now_url.replace("{guid}", deviceId)}`, true);
        const options: RequestOptions = this.getRequestOptions(HttpMethod.Get, uri);
        const result = await this.request(options);
        result.deviceGuid = deviceId;
        return result as Device;
    }

    /**
     * Set parameters on device. Parameters can contain one or more properties.
     * @param deviceId Device ID to use. Aka deviceGuid
     * @param parameters Parameters to set
     * @returns
     */
    public async setParameters(deviceId: string, parameters: DeviceParameters): Promise<UpdateResponse> {
        try {
            const uri = url.parse(`${this._config.base_url}${this._config.device_control_url}`, true);
            const options: RequestOptions = this.getRequestOptions(HttpMethod.Post, uri);
            const requestBody = { deviceGuid: deviceId, parameters: this.getParameters(parameters) };
            const result = await this.request(options, JSON.stringify(requestBody));
            const response: UpdateResponse = { status: -1, statusText: "Unknown response" };
            if (result) {
                response.status = result.result;
                response.statusText = "OK";
                return response;
            }
            return response;
        } catch (error: any) {
            if (error.statusCode === 401 || error.statusCode === 403) throw error;
            error.statusText = "Invalid parameter. Please check the input and use the Device's boolean values to check valid capabilities.";
            throw error;
        }
    }

    /**
     * Set parameters from device. Manipulate device parameters before calling.
     * @param device Device ID to be used
     * @returns true if recuest succeeds
     */
    public async setDevice(device: Device): Promise<UpdateResponse> {
        try {
            const parameters: DeviceParameters = this.getDeviceParameters(device);
            const res = await this.setParameters(device.deviceGuid, parameters);
            return res;
        } catch (error: any) {
            const res: UpdateResponse = { status: -1 };
            if (error && error.code && error.message) {
                res.error = error;
                res.status = error.code;
            }
            return res;
        }
    }

    public getDeviceParameters(device: Device): DeviceParameters {
        const parameters: DeviceParameters = {};
        if (!device.parameters) return parameters;
        if (device.parameters.operate !== undefined) parameters.operate = device.parameters.operate;
        if (device.parameters.temperatureSet !== undefined) parameters.temperatureSet = device.parameters.temperatureSet;
        if (device.parameters.fanAutoMode !== undefined) parameters.fanAutoMode = device.parameters.fanAutoMode;
        if (device.parameters.airDirection !== undefined) parameters.airDirection = device.parameters.airDirection;
        if (device.parameters.airSwingLR !== undefined) parameters.airSwingLR = device.parameters.airSwingLR;
        if (device.parameters.airSwingUD !== undefined) parameters.airSwingUD = device.parameters.airSwingUD;
        if (device.parameters.fanSpeed !== undefined) parameters.fanSpeed = device.parameters.fanSpeed;
        if (device.parameters.ecoFunctionData !== undefined) parameters.ecoFunctionData = device.parameters.ecoFunctionData;
        if (device.parameters.ecoMode !== undefined) parameters.ecoMode = device.parameters.ecoMode;
        if (device.nanoeStandAlone && device.parameters.actualNanoe !== undefined) parameters.actualNanoe = device.parameters.actualNanoe;
        if (device.nanoe && device.parameters.nanoe !== undefined) parameters.nanoe = device.parameters.nanoe;
        if (
            (device.autoMode && device.parameters.operationMode === OperationMode.Auto) ||
            (device.coolMode && device.parameters.operationMode === OperationMode.Cool) ||
            (device.dryMode && device.parameters.operationMode === OperationMode.Dry) ||
            (device.heatMode && device.parameters.operationMode === OperationMode.Heat) ||
            (device.fanMode && device.parameters.operationMode === OperationMode.Fan)
        )
            parameters.operationMode = device.parameters.operationMode;
        return parameters;
    }

    public getParameters(parameters: DeviceParameters): DeviceParameters {
        const par: DeviceParameters = {};
        if (!parameters) return par;
        if (parameters.operate !== undefined) par.operate = parameters.operate;
        if (parameters.temperatureSet !== undefined) par.temperatureSet = parameters.temperatureSet;
        if (parameters.fanAutoMode !== undefined) par.fanAutoMode = parameters.fanAutoMode;
        if (parameters.airDirection !== undefined) par.airDirection = parameters.airDirection;
        if (parameters.airSwingLR !== undefined) par.airSwingLR = parameters.airSwingLR;
        if (parameters.airSwingUD !== undefined) par.airSwingUD = parameters.airSwingUD;
        if (parameters.fanSpeed !== undefined) par.fanSpeed = parameters.fanSpeed;
        if (parameters.actualNanoe !== undefined) par.actualNanoe = parameters.actualNanoe;
        if (parameters.nanoe !== undefined) par.nanoe = parameters.nanoe;
        if (parameters.ecoFunctionData !== undefined) par.ecoFunctionData = parameters.ecoFunctionData;
        if (parameters.ecoMode !== undefined) par.ecoMode = parameters.ecoMode;
        if (parameters.operationMode !== undefined) par.operationMode = parameters.operationMode;
        return par;
    }

    /**
     *
     * @param options RequestOprions to use
     * @param data optional data to use for request body
     * @returns Promise<any>
     */
    private async request(options: https.RequestOptions, data?: any): Promise<any> {
        const self = this;
        return await new Promise<any>((resolve, reject) => {
            const req = https.request(options, (res: any) => {
                let str: string = "";
                res.on("data", function (chunk: string) {
                    str += chunk;
                });
                res.on("end", function () {
                    let response: any = self.isJsonString(str) ? JSON.parse(str) : str;
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(response);
                    else {
                        response.httpCode = res.statusCode;
                        response.statusCode = res.statusCode;
                        response.statusMessage = res.statusMessage;
                        reject(response);
                    }
                });
            });
            req.on("error", (e: any) => {
                console.error(`problem with request: ${e.message}`);
                reject(e);
            });
            if (data) {
                req.write(data);
            }
            req.end();
        });
    }

    /**
     *
     * @param method HTTP method to use
     * @param uri Uri to use
     * @returns An object containing request options
     */
    private getRequestOptions(method: HttpMethod, uri: url.UrlWithParsedQuery): https.RequestOptions {
        return {
            host: uri.host,
            port: uri.port,
            path: uri.path,
            method: method,
            headers: {
                Connection: "Keep-Alive",
                "Content-Type": "application/json",
                Accept: "application/json",
                Host: uri.hostname as string,
                "X-APP-TYPE": 1,
                "X-APP-VERSION": "1.20.0",
                "X-User-Authorization": this._accessToken,
                "User-Agent": "G-RAC",
            },
        };
    }

    isJsonString(str: string) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
}
