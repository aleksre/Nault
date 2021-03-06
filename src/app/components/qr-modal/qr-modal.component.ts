import { Component, Input, OnInit } from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from "../../services/notification.service";
import { BarcodeFormat } from '@zxing/library';
import { BehaviorSubject } from 'rxjs';
import { UtilService } from '../../services/util.service';
import * as bip39 from 'bip39'

export type QRType = "account" | "hash" | "mnemonic" | "generic";

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.css']
})
export class QrModalComponent implements OnInit {

  @Input() title = 'QR Scanner';
  @Input() reference:string;
  @Input() type:QRType;
  availableDevices: MediaDeviceInfo[];
  currentDevice: MediaDeviceInfo = null;
  nano_scheme = /^(xrb|nano|nanorep|nanoseed|nanokey):.+$/g

  formatsEnabled: BarcodeFormat[] = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.EAN_13,
    BarcodeFormat.QR_CODE,
  ];

  hasDevices: boolean;
  hasPermission: boolean;

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(false);
  tryHarder = false;

  constructor(
    public activeModal: NgbActiveModal,
    private notifcationService: NotificationService,
    private util: UtilService,
  ) { }

  ngOnInit(): void {
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {    
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
  }

  onCodeResult(resultString: string) {
    var type: QRType = null;
    var content: string = '';
    // account
    if (this.util.account.isValidAccount(resultString)) {
      type = 'account';
      content = resultString;
    }
    // mnemonic
    else if (bip39.validateMnemonic(resultString)) {
      type = 'mnemonic';
      content = resultString;
    }
    // expanded private key
    else if (resultString.length === 128) {
      // includes deterministic R value material which we ignore
      resultString = resultString.substring(0, 64);
      if (this.util.nano.isValidHash(resultString)) {
        type = 'hash';
        content = resultString;
      }
    }
    // block hash, seed, public or private key
    else if (this.util.nano.isValidHash(resultString)) {
      type = 'hash';
      content = resultString;
    }
    // special url formatted account, rep, seed, key
    else if(this.nano_scheme.test(resultString)) {
      // This is a valid Nano scheme URI
      var url = new URL(resultString)
      content = url.pathname;

      if((url.protocol === 'nano:' || url.protocol === 'nanorep:' || url.protocol === 'xrb:') && this.util.account.isValidAccount(url.pathname)){
        type = 'account';
      }
      else if((url.protocol === 'nanoseed:' || url.protocol === 'nanokey:') && this.util.nano.isValidHash(url.pathname)){
        type = 'hash';
      }
    }
    // generic type
    else {
      type = 'generic';
      content = resultString;
    }

    // check that the result is valid and matched the requested type
    if (type != null && type === this.type || this.type === 'generic') {
      this.activeModal.close({reference: this.reference, content: content})
    }
    else {
      this.notifcationService.sendWarning('This QR code is not recognized.', { length: 5000, identifier: 'qr-not-recognized' })
      return;
    }
  }

  onDeviceSelectChange(selected: string) {
    const device = this.availableDevices.find(x => x.deviceId === selected);
    this.currentDevice = device || null;
  }

  onHasPermission(has: boolean) {
    this.hasPermission = has;
  }

  onTorchCompatible(isCompatible: boolean): void {
    this.torchAvailable$.next(isCompatible || false);
  }

  toggleTorch(): void {
    this.torchEnabled = !this.torchEnabled;
  }

  toggleTryHarder(): void {
    this.tryHarder = !this.tryHarder;
  }
}
