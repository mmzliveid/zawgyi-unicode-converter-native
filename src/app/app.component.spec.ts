/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed, async } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { MenuController, ModalController, Platform, ToastController } from '@ionic/angular';

import { Subject } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AppRate } from '@ionic-native/app-rate/ngx';
import { FirebaseX } from '@ionic-native/firebase-x/ngx';
import { HeaderColor } from '@ionic-native/header-color/ngx';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { WebIntent } from '@ionic-native/web-intent/ngx';

import { LogModule } from '@dagonmetric/ng-log';
import { TranslitModule } from '@dagonmetric/ng-translit';

import { ZawgyiDetectorModule } from '@myanmartools/ng-zawgyi-detector';

import { ZgUniTranslitRuleLoaderModule } from '../modules/zg-uni-translit-rule-loader';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
    let platformSpy: any;
    let statusBarSpy: any;
    let splashScreenSpy: any;

    let appRateSpy: any;
    let firebaseXSpy: any;
    let headerColorSpy: any;
    let nativeStorageSpy: any;
    let socialSharingSpy: any;
    let webIntentSpy: any;

    let menuControllerSpy: any;
    let modalControllerSpy: any;
    let toastControllerSpy: any;

    beforeEach(async(() => {
        platformSpy = jasmine.createSpyObj('Platform', {
            ready: Promise.resolve(),
            backButton: new Subject(),
            pause: new Subject().asObservable(),
            resume: new Subject().asObservable(),
            is: () => {
                return false;
            }
        });
        statusBarSpy = jasmine.createSpyObj('StatusBar', ['styleLightContent', 'backgroundColorByHexString']);
        splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide']);
        appRateSpy = jasmine.createSpyObj('AppRate', ['promptForRating', 'preferences']);
        firebaseXSpy = jasmine.createSpyObj('FirebaseX', ['fetch', 'activateFetched', 'getValue']);
        headerColorSpy = jasmine.createSpyObj('HeaderColor', ['tint']);
        nativeStorageSpy = jasmine.createSpyObj('NativeStorage', ['setItem', 'getItem']);
        socialSharingSpy = jasmine.createSpyObj('SocialSharing', ['shareWithOptions']);
        webIntentSpy = jasmine.createSpyObj('WebIntent', [
            'unregisterBroadcastReceiver',
            'registerBroadcastReceiver',
            'getIntent'
        ]);
        menuControllerSpy = jasmine.createSpyObj('MenuController', ['toggle', 'isOpen', 'close']);
        modalControllerSpy = jasmine.createSpyObj('ModalController', ['create', 'getTop', 'dismiss']);
        toastControllerSpy = jasmine.createSpyObj('ToastController', ['create']);

        void TestBed.configureTestingModule({
            declarations: [AppComponent],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
            imports: [
                CommonModule,
                FormsModule,
                NoopAnimationsModule,

                MatFormFieldModule,
                MatInputModule,

                LogModule,
                TranslitModule,
                ZgUniTranslitRuleLoaderModule,
                ZawgyiDetectorModule
            ],
            providers: [
                { provide: Platform, useValue: platformSpy },
                { provide: StatusBar, useValue: statusBarSpy },
                { provide: SplashScreen, useValue: splashScreenSpy },
                { provide: AppRate, useValue: appRateSpy },
                { provide: FirebaseX, useValue: firebaseXSpy },
                { provide: HeaderColor, useValue: headerColorSpy },
                { provide: NativeStorage, useValue: nativeStorageSpy },
                { provide: SocialSharing, useValue: socialSharingSpy },
                { provide: WebIntent, useValue: webIntentSpy },
                { provide: MenuController, useValue: menuControllerSpy },
                { provide: ModalController, useValue: modalControllerSpy },
                { provide: ToastController, useValue: toastControllerSpy }
            ]
        }).compileComponents();
    }));

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.debugElement.componentInstance;
        void expect(app).toBeTruthy();
    });
});
