/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';

import { MenuController, ModalController, Platform, ToastController } from '@ionic/angular';
import { Storage as IonicStorage } from '@ionic/storage';

import { AppRate } from '@ionic-native/app-rate/ngx';
import { HeaderColor } from '@ionic-native/header-color/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { WebIntent } from '@ionic-native/web-intent/ngx';

import { ConfigService } from '@dagonmetric/ng-config';
import { LogService } from '@dagonmetric/ng-log';
import { TranslitResult, TranslitService } from '@dagonmetric/ng-translit';

import { DetectedEnc, ZawgyiDetector } from '@myanmartools/ng-zawgyi-detector';

import { AppConfig, NavLinkItem } from './shared';

import { AboutModalComponent } from './about/about-modal.component';
import { SupportModalComponent } from './support/support-modal.component';

export type SourceEnc = 'auto' | DetectedEnc;

/**
 * Core app component.
 */
@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements AfterViewInit, OnInit, OnDestroy {
    fontEncSelectedText = 'AUTO DETECT';

    private readonly _appConfig: AppConfig;
    private readonly _sourcePlaceholderAuto = 'Enter Zawgyi or Unicode text here';
    private readonly _sourcePlaceholderZg = 'Enter Zawgyi text here';
    private readonly _sourcePlaceholderUni = 'Enter Unicode text here';

    private readonly _targetPlaceholderAuto = 'Converted text will be appeared here';
    private readonly _targetPlaceholderZg = 'Converted Zawgyi text will be appeared here';
    private readonly _targetPlaceholderUni = 'Converted Unicode text will be appeared here';

    private readonly _translitSubject = new Subject<string>();
    private readonly _destroyed = new Subject<void>();

    private readonly _timePeriodToExit = 2000;

    private _backButtonSubscription?: Subscription;
    private _sourceText = '';
    private _outText = '';
    private _sourceEnc?: SourceEnc = 'auto';
    private _targetEnc?: DetectedEnc;
    private _sourcePlaceholderText = '';
    private _targetPlaceholderText = '';

    private _detectedEnc: DetectedEnc = null;
    private _curRuleName = '';
    private _isFromIntent = false;

    private _lastTimeBackPress = 0;

    get appName(): string {
        return this._appConfig.appName;
    }

    get appVersion(): string {
        return this._appConfig.appVersion;
    }

    get navLinks(): NavLinkItem[] {
        return this._appConfig.navLinks || [];
    }

    get privacyUrl(): string | undefined {
        return this._appConfig.privacyUrl;
    }

    get detectedEnc(): DetectedEnc {
        return this._detectedEnc;
    }

    get sourceEncLabel(): string {
        if (this._detectedEnc === 'zg') {
            return 'ZAWGYI';
        } else if (this._detectedEnc === 'uni') {
            return 'UNICODE';
        } else {
            return '';
        }
    }

    get targeetEncLabel(): string {
        if (this._detectedEnc === 'zg') {
            return 'UNICODE';
        } else if (this._detectedEnc === 'uni') {
            return 'ZAWGYI';
        } else {
            return '';
        }
    }

    get sourceText(): string {
        return this._sourceText;
    }
    set sourceText(val: string) {
        this._sourceText = val;
        this.translitNext();
    }

    get sourceEnc(): SourceEnc | undefined {
        return this._sourceEnc;
    }
    set sourceEnc(val: SourceEnc | undefined) {
        if (!val) {
            return;
        }

        this._sourceEnc = val;
        this.onSourceEncChanged(val);
    }

    get targetEnc(): DetectedEnc | undefined {
        return this._targetEnc;
    }

    get outText(): string {
        return this._outText;
    }

    get textAreaMinRows(): number {
        const platformHeight = this._platform.height();

        // iPhone: 568, 640, 667,  736, 812,  896
        //  Android: 640, 732, 740, 824, 847,  853

        if (platformHeight >= 900) {
            return 10;
        } else if (platformHeight >= 820) {
            return 8;
        } else if (platformHeight >= 730) {
            return 7;
        } else if (platformHeight >= 640) {
            return 6;
        } else if (platformHeight >= 580) {
            return 5;
        } else {
            return 4;
        }
    }

    get sourcePlaceholderText(): string {
        return this._sourcePlaceholderText || this._sourcePlaceholderAuto;
    }

    get targetPlaceholderText(): string {
        return this._targetPlaceholderText || this._targetPlaceholderAuto;
    }

    constructor(
        private readonly _translitService: TranslitService,
        private readonly _zawgyiDetector: ZawgyiDetector,
        private readonly _logService: LogService,
        private readonly _platform: Platform,
        private readonly _splashScreen: SplashScreen,
        private readonly _statusBar: StatusBar,
        private readonly _headerColor: HeaderColor,
        private readonly _menuController: MenuController,
        private readonly _modalController: ModalController,
        private readonly _toastController: ToastController,
        private readonly _socialSharing: SocialSharing,
        private readonly _storage: IonicStorage,
        private readonly _appRate: AppRate,
        private readonly _webIntent: WebIntent,
        configService: ConfigService) {
        this._appConfig = configService.getValue<AppConfig>('app');
        this.initializeApp();
    }

    ngOnInit(): void {
        this._translitSubject.pipe(
            debounceTime(200),
            distinctUntilChanged(),
            takeUntil(this._destroyed),
            switchMap(() => {
                const input = this._sourceText;
                if (!input || !input.trim().length) {
                    if (this._sourceEnc === 'auto' || !this.detectedEnc) {
                        this.resetFontEncSelectedText();
                        this._sourceEnc = 'auto';
                        this._detectedEnc = null;
                    }

                    return of({
                        outputText: input,
                        replaced: false,
                        duration: 0
                    });
                }

                if (this._sourceEnc === 'auto' || !this.detectedEnc) {
                    const detectorResult = this._zawgyiDetector.detect(input, { detectMixType: false });
                    this._detectedEnc = detectorResult.detectedEnc;

                    if (detectorResult.detectedEnc === 'zg') {
                        this.resetFontEncSelectedText('ZAWGYI DETECTED');
                        this._sourceEnc = 'auto';
                        this._detectedEnc = 'zg';
                        this._targetEnc = 'uni';
                    } else if (detectorResult.detectedEnc === 'uni') {
                        this.resetFontEncSelectedText('UNICODE DETECTED');
                        this._sourceEnc = 'auto';
                        this._detectedEnc = 'uni';
                        this._targetEnc = 'zg';
                    } else {
                        this.resetFontEncSelectedText();
                        this._sourceEnc = 'auto';
                        this._detectedEnc = null;

                        return of({
                            replaced: false,
                            outputText: input,
                            duration: 0
                        });
                    }
                }

                this._curRuleName = this.detectedEnc === 'zg' ? 'zg2uni' : 'uni2zg';

                return this._translitService.translit(input, this._curRuleName)
                    .pipe(
                        takeUntil(this._destroyed)
                    );
            })
        ).subscribe((result: TranslitResult) => {
            this._outText = result.outputText || '';

            if (this._sourceText.length && this._curRuleName && result.replaced) {
                this._logService.trackEvent({
                    name: 'convert',
                    properties: {
                        method: this._curRuleName,
                        input_length: this._sourceText.length,
                        duration_msec: result.duration,
                        from_intent: this._isFromIntent
                    }
                });

                this._isFromIntent = false;
            }
        });
    }

    ngAfterViewInit(): void {
        this._backButtonSubscription = this._platform.backButton.subscribe(async () => {
            try {
                const ele = await this._modalController.getTop();
                if (ele) {
                    // tslint:disable-next-line: no-floating-promises
                    this._modalController.dismiss({
                        dismissed: true
                    });

                    return;
                }
            } catch (err) {
                // Do nothing
            }

            try {
                const isMenuOpened = await this._menuController.isOpen();
                if (isMenuOpened) {
                    // tslint:disable-next-line: no-floating-promises
                    this._menuController.close();

                    this._logService.trackEvent({
                        name: 'toggle_drawer_menu',
                        properties: {
                            action: 'close'
                        }
                    });

                    return;
                }
            } catch (err) {
                // Do nothing
            }

            if (new Date().getTime() - this._lastTimeBackPress < this._timePeriodToExit) {
                this._logService.flush();

                // tslint:disable-next-line: no-any no-unsafe-any no-string-literal
                (navigator as any)['app'].exitApp();
            } else {
                const toast = await this._toastController.create({
                    message: 'Press back again to exit the app.',
                    duration: 2000
                });
                // tslint:disable-next-line: no-floating-promises
                toast.present();

                this._lastTimeBackPress = new Date().getTime();
            }
        });
    }

    ngOnDestroy(): void {
        if (this._backButtonSubscription) {
            this._backButtonSubscription.unsubscribe();
        }

        this._destroyed.next();
        this._destroyed.complete();

        this._logService.flush();
    }

    async showShareSheet(): Promise<void> {
        this._appConfig.socialSharing = this._appConfig.socialSharing || {};
        const socialSharingSubject = this._appConfig.socialSharing.subject;
        const socialSharingLink = this._appConfig.socialSharing.linkUrl;
        const socialSharingMessage = this._appConfig.socialSharing.message;

        try {
            // tslint:disable-next-line: no-floating-promises
            await this._socialSharing.shareWithOptions({
                message: socialSharingMessage,
                subject: socialSharingSubject,
                url: socialSharingLink
                // appPackageName
            });

            const toast = await this._toastController.create({
                message: 'Thank you for sharing the app.',
                duration: 2000
            });
            // tslint:disable-next-line: no-floating-promises
            toast.present();

            this._logService.trackEvent({
                name: 'share',
                properties: {
                    method: 'Social Sharing Native'
                }
            });
        } catch (err) {
            // tslint:disable-next-line: no-unsafe-any
            const errMsg = err && err.message ? ` ${err.message}` : '';
            this._logService.warn(`An error occurs when sharing via Web API.${errMsg}`, {
                properties: {
                    app_version: this._appConfig.appVersion
                }
            });
        }
    }

    promptForRating(): void {
        this._appRate.promptForRating(true);

        this._logService.trackEvent({
            name: 'rate',
            properties: {
                method: 'App Rate Native'
            }
        });
    }

    async toggleSideNav(): Promise<void> {
        const isOpened = await this._menuController.toggle();
        this._logService.trackEvent({
            name: 'toggle_drawer_menu',
            properties: {
                action: isOpened ? 'open' : 'close'
            }
        });
    }

    async showAboutModal(): Promise<void> {
        const modal = await this._modalController.create({
            component: AboutModalComponent
        });

        // tslint:disable-next-line: no-floating-promises
        modal.onDidDismiss().then(() => {
            this._logService.trackEvent({
                name: 'screen_view',
                properties: {
                    screen_name: 'Home'
                }
            });
        });
        await modal.present();

        this._logService.trackEvent({
            name: 'screen_view',
            properties: {
                screen_name: 'About'
            }
        });
    }

    async showHelpModal(): Promise<void> {
        const modal = await this._modalController.create({
            component: SupportModalComponent
        });

        // tslint:disable-next-line: no-floating-promises
        modal.onDidDismiss().then(() => {
            this._logService.trackEvent({
                name: 'screen_view',
                properties: {
                    screen_name: 'Home'
                }
            });
        });
        await modal.present();

        this._logService.trackEvent({
            name: 'screen_view',
            properties: {
                screen_name: 'Support'
            }
        });
    }

    private initializeApp(): void {
        const storeAppUrlInfo = this._appConfig.storeAppUrlInfo;
        const appThemeColor = this._appConfig.appThemeColor;

        // tslint:disable-next-line: no-floating-promises
        this._platform.ready().then(() => {
            if (this._platform.is('android') || this._platform.is('ios')) {
                this._statusBar.styleLightContent();
            }

            if (this._platform.is('android')) {
                this._statusBar.backgroundColorByHexString(`#FF${appThemeColor.replace('#', '')}`);

                // tslint:disable-next-line: no-floating-promises
                this._headerColor.tint(appThemeColor);
            }

            if (this._platform.is('android') || this._platform.is('ios')) {
                this._splashScreen.hide();
            }

            if (this._platform.is('android')) {
                this.registerBroadcastReceiverAndroid();

                // tslint:disable-next-line: no-floating-promises
                this._webIntent.getIntent().then(intent => {
                    if (intent.extras) {
                        const textExtras = (intent.extras as { [key: string]: string })['android.intent.extra.TEXT'];
                        if (textExtras) {
                            this._sourceText = textExtras;
                            this._isFromIntent = true;
                            this.translitNext();
                        }
                    }
                });
            }

            this._platform.pause
                .pipe(
                    takeUntil(this._destroyed),
                ).subscribe(() => {
                    this.onPlatformPaused();
                });

            this._platform.resume
                .pipe(
                    takeUntil(this._destroyed),
                )
                .subscribe(() => {
                    this.onPlatformResumed();
                });

            if (!this._sourceText) {
                const welcomeCachekey = `is-shown-welcome-screen-v${this.appVersion}`;

                // tslint:disable-next-line: no-backbone-get-set-outside-model no-floating-promises
                this._storage.get(welcomeCachekey)
                    .then((isWelcomeScreenShown: string) => {
                        if (!isWelcomeScreenShown) {
                            // tslint:disable-next-line: no-floating-promises
                            this.showAboutModal();
                            // tslint:disable-next-line: no-floating-promises
                            this._storage.set(welcomeCachekey, true);
                        } else {
                            this._logService.trackEvent({
                                name: 'screen_view',
                                properties: {
                                    screen_name: 'Home'
                                }
                            });
                        }
                    });
            }

            if (this._platform.is('android') || this._platform.is('ios')) {
                this._appRate.preferences = {
                    useLanguage: 'en',
                    displayAppName: this.appName,
                    usesUntilPrompt: 3,
                    promptAgainForEachNewVersion: true,
                    simpleMode: true,
                    useCustomRateDialog: true,
                    storeAppURL: {
                        ...storeAppUrlInfo
                    },
                    customLocale: {
                        title: 'Do you \u2764\uFE0F using this app?',
                        message: "If you enjoy using Zawgyi Unicode Converter, you would mind taking a moment to rate it? It won't take more than a minute. Thank you for your support!",
                        cancelButtonLabel: 'No, thanks',
                        laterButtonLabel: 'Later',
                        rateButtonLabel: 'Rate it now',
                        yesButtonLabel: 'Yes',
                        noButtonLabel: 'No'
                    }
                };

                this._appRate.promptForRating(false);
            }
        });
    }

    private onPlatformPaused(): void {
        if (this._platform.is('android')) {
            this._webIntent.unregisterBroadcastReceiver();
        }
    }

    private onPlatformResumed(): void {
        if (this._platform.is('android')) {
            this.registerBroadcastReceiverAndroid();
        }
    }

    private registerBroadcastReceiverAndroid(): void {
        this._webIntent.registerBroadcastReceiver({
            filterActions: [
                'com.darryncampbell.cordova.plugin.broadcastIntent.ACTION'
            ]
        });
    }

    private onSourceEncChanged(val?: SourceEnc): void {
        this._sourceEnc = val;

        if (val === 'uni' || val === 'zg') {
            this._detectedEnc = val;
            const selectedText = val === 'zg' ? 'ZAWGYI' : 'UNICODE';
            this.resetFontEncSelectedText(selectedText);
            if (val === 'zg') {
                this._sourcePlaceholderText = this._sourcePlaceholderZg;
                this._targetPlaceholderText = this._targetPlaceholderUni;
            } else {
                this._sourcePlaceholderText = this._sourcePlaceholderUni;
                this._targetPlaceholderText = this._targetPlaceholderZg;
            }
        } else {
            this._detectedEnc = null;
            this.resetFontEncSelectedText();
            this._sourcePlaceholderText = this._sourcePlaceholderAuto;
            this._targetPlaceholderText = this._targetPlaceholderAuto;
        }

        if (this._sourceEnc === 'zg' && (!this.targetEnc || this.targetEnc === 'zg')) {
            this._targetEnc = 'uni';
        } else if (this._sourceEnc === 'uni' && (!this.targetEnc || this.targetEnc === 'uni')) {
            this._targetEnc = 'zg';
        }

        this._logService.trackEvent({
            name: 'change_input_font_enc',
            properties: {
                font_enc: this.sourceEnc
            }
        });

        this.translitNext();
    }

    private resetFontEncSelectedText(text?: string): void {
        this.fontEncSelectedText = text || 'AUTO DETECT';
    }

    private translitNext(): void {
        this._translitSubject.next(`${this._sourceEnc}|${this._sourceText}`);
    }
}