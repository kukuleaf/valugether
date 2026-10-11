# Official social sign-in assets

These files are extracted unchanged from the official asset bundles supplied by the project owner. Only the three required PNG entries were copied; the original ZIP archives remain untouched.

| Local file           | Official ZIP entry                                                                                                        | Pixels    | Display           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------- |
| `google-sign-in.png` | `signin-assets.zip` → `Android + Web/PNG @4x/Light/Theme=Light, Show text=Yes, Shape=Square, Platform=Android+Web@4x.png` | 720 × 160 | 216 × 48 dp       |
| `kakao-login-ko.png` | `Kakao Login.zip` → `Kakao Login/PNG @4x/kakao_login_kr_medium.png`                                                       | 896 × 184 | about 234 × 48 dp |
| `naver-login-ko.png` | `NAVER_login_KR.zip` → `NAVER_login_KR/NAVER_login_Light_KR_green_narrow_H48.png`                                         | 840 × 192 | 210 × 48 dp       |

The screen uses `resizeMode="contain"` with the original aspect ratio, at least 48 dp touch height, and explicit accessible button labels. Logos, colors, and embedded text are not redrawn, recolored, cropped, stretched, or covered. Loading and availability messages appear outside the official graphics.

The NAVER Korean bundle already contains high-density PNGs; its H48 file has a 192-pixel height, equivalent to 4× resolution. The English NAVER bundle is not needed on the current Korean screen. Local names omit the density suffix so Metro resolves a canonical asset path; pixel data is unchanged and explicit display dimensions preserve the aspect ratio.

Google remains visibly unavailable until its authentication integration is complete. NAVER is available only in a configured Android build with the local native login module; web, iOS, and Expo Go keep it unavailable. Kakao retains its existing Android login flow. No provider client secrets are stored with these assets or in the JavaScript mobile source.

Brand guidance checked on 2026-10-11:

- [Google Identity branding guidelines](https://developers.google.com/identity/branding-guidelines): pre-approved image buttons and proportional scaling.
- [Kakao Login design guide](https://developers.kakao.com/docs/ko/kakaologin/design-guide): official button resources, yellow container, unchanged symbol proportions.
- [NAVER Login button guide](https://developers.naver.com/docs/login/bi/bi.md): official N symbol and current green `#03A94D` as supplied in the PNG.

The respective brand owners retain their rights. Use these assets only for their corresponding sign-in actions.
