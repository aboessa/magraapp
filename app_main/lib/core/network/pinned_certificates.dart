/// SEC-105 — جذور الثقة المثبَّتة لاتصالات «مجرة».
///
/// ## العلّة
///
/// كل اتصالات التطبيق كانت تعتمد مخزن شهادات النظام وحده: لا
/// `SecurityContext` ولا `HttpClient` مخصص في أي ملف تحت `lib/`. على جهاز فيه
/// شهادة جذر مثبَّتة — وهو حال كل أداة تحليل شبكي، وكل جهاز مُدار من جهة عمل
/// أو مدرسة، وكل جهاز يشغّل وكيل اعتراض — تصير كل الطلبات مقروءة: توكن الوصول،
/// وتوكن الوسائط، وردود الترخيص. والشهادة المزروعة **صالحة** في نظر النظام،
/// فلا `badCertificateCallback` يُستدعى ولا خطأ يظهر.
///
/// ## لماذا تثبيت الجذر لا تثبيت المفتاح العام للورقة
///
/// في `dart:io` يستقبل `badCertificateCallback` **شهادة الخادم وحدها**، لا
/// السلسلة، ولا يُستدعى أصلًا حين تكون السلسلة صالحة. أي أن «حساب SPKI ومقارنته»
/// غير قابل للتنفيذ على السلسلة، والمتاح هو الورقة فقط — وشهادة الورقة تتجدّد
/// كل ثلاثة أشهر عند Cloudflare، فتثبيتها يعني تعطّل التطبيق في الحقل عند كل
/// تجديد روتيني. وهذا ما يحذّر منه بند الأودت صراحةً.
///
/// الوسيلة الصحيحة في `dart:io` هي عكس ذلك: `SecurityContext(withTrustedRoots:
/// false)` مع حزمة جذور **نحن** نحدّدها. حينها يتحقّق BoringSSL من السلسلة كاملة
/// مقابل هذه الحزمة وحدها، فشهادة جذر مزروعة على الجهاز لا تُبنى منها سلسلة
/// صالحة ويفشل الاتصال — وهو التهديد المقصود بالضبط. والورقة والوسيط يتجدّدان
/// بحرّية داخل نفس الهرم بلا أثر على التطبيق.
///
/// ## من أين جاءت هذه الجذور
///
/// من سلسلة الإنتاج الحقيقية، مقروءة من `api.majarra.app` و`cdn.majarra.app`
/// في 2026-08-26. المضيفان يقدّمان نفس الهرم:
///
/// ```
/// leaf (CN=majarra.app / *.sni.cloudflaressl.com)
///   └── CN=WE1, O=Google Trust Services      (ينتهي 2029-02-20)
///         └── GTS Root R4 (مُوقَّعة تقاطعيًّا) (ينتهي 2028-01-28)
///               └── GlobalSign Root CA        (ينتهي 2028-01-28)
/// ```
///
/// الحزمة تحوي **الجذر الموقَّع ذاتيًّا** لكل من GTS R1..R4 (تنتهي 2036-06-22)
/// وGlobalSign Root CA. سببان لإدراج الخمسة لا واحد:
///
///  1. **مسارَا بناء**: السلسلة المُقدَّمة تنتهي عند GlobalSign، ويمكن أيضًا أن
///     تُختصر عند GTS Root R4 نفسه. إدراج الاثنين يجعل التحقّق ينجح في الحالتين،
///     فلا يتحوّل تغيير في ترتيب السلسلة عند Cloudflare إلى انقطاع.
///  2. **دوران داخل الهرم**: Google Trust Services تُصدر من R1..R4 وتنقل
///     الوسطاء بينها. تثبيت الجذور الأربعة يستوعب ذلك بلا تحديث تطبيق.
///
/// ملفات PEM أُنزلت من `https://pki.goog/repo/certs/` وتحقّقت بصمتها، ويثبّتها
/// [pinnedRootFingerprints] فلا يمكن استبدال شهادة في الحزمة بلا فشل اختبار.
///
/// ## ما لا يشمله التثبيت — وهذا مقصود ومحدود
///
///  * **مشغّل الفيديو والصوت** (`video_player`, `just_audio`): يفتح اتصاله في
///    الطبقة الأصلية (ExoPlayer/AVPlayer) ولا يمرّ بـ`dart:io`. تثبيته يحتاج
///    قناة native وهو بند منفصل. الأثر محدود: مسار الوسائط يحمل توكنًا قصير
///    الأجل (3 دقائق) لا توكن الحساب، والمحتوى نفسه مُعمّى في مسار التنزيل.
///  * **`Image.network`**: يستخدم `HttpClient` داخليًّا من `ImageCache` لا
///    عميلنا. صور الأغلفة عامة ولا تحمل سرًّا.
///
/// ## إجراء الدوران — اقرأه قبل أي تحديث
///
/// 1. اقرأ السلسلة الحيّة:
///    `openssl s_client -connect api.majarra.app:443 -servername api.majarra.app -showcerts`
/// 2. إن بقي الجذر داخل هرم GTS أو GlobalSign فلا شيء مطلوب.
/// 3. إن تغيّرت جهة الإصدار (مثلًا إلى Let's Encrypt / ISRG Root X1 أو
///    SSL.com) فأضف جذرها إلى [pinnedRootsPem] وبصمتها إلى
///    [pinnedRootFingerprints] **قبل** أن ينتقل الخادم، وانشر التحديث.
/// 4. حدِّث [pinningEnforcedUntil] مع كل إصدار.
///
/// ## لماذا للتثبيت تاريخ انتهاء
///
/// التثبيت خطر توافر بطبيعته: خطأ في الحزمة، أو تغيير جهة إصدار لم نلحقه،
/// يمنع كل نسخة منشورة من الوصول إلى الخادم، ولا علاج من جهة الخادم لأن قناة
/// الإصلاح هي نفس القناة المعطَّلة. [pinningEnforcedUntil] يحدّ هذا الخطر:
/// بعد التاريخ يعود البناء القديم إلى ثقة النظام بدل أن يبقى معطَّلًا إلى
/// الأبد. هذا هو نفس نهج الجذور الثابتة في المتصفّحات: تنتهي مع كل إصدار.
///
/// التاريخ **قبل** انتهاء GlobalSign Root CA (2028-01-28) عن قصد، فلا يمكن أن
/// يصبح التثبيت ساريًا على جذر منتهٍ.
library;

/// الحدّ الزمني لفرض التثبيت (UTC).
///
/// يُحدَّث مع كل إصدار. بعده يعود التطبيق إلى مخزن شهادات النظام — انظر شرح
/// المكتبة أعلاه.
final DateTime pinningEnforcedUntil = DateTime.utc(2027, 8, 26);

/// بصمة SHA-256 لكل شهادة في [pinnedRootsPem]، بترتيب ورودها.
///
/// الغرض ليس التحقّق وقت التشغيل — BoringSSL يفعل ذلك — بل منع تعديل الحزمة
/// بلا مراجعة: أي استبدال أو إضافة أو حذف يُفشل `test/tls_pinning_test.dart`.
const List<String> pinnedRootFingerprints = <String>[
  // CN=GTS Root R1, O=Google Trust Services LLC — ينتهي 2036-06-22
  'd947432abde7b7fa90fc2e6b59101b1280e0e1c7e4e40fa3c6887fff57a7f4cf',
  // CN=GTS Root R2 — ينتهي 2036-06-22
  '8d25cd97229dbf70356bda4eb3cc734031e24cf00fafcfd32dc76eb5841c7ea8',
  // CN=GTS Root R3 — ينتهي 2036-06-22
  '34d8a73ee208d9bcdb0d956520934b4e40e69482596e8b6f73c8426b010a6f48',
  // CN=GTS Root R4 — الجذر الفعلي لسلسلة الإنتاج — ينتهي 2036-06-22
  '349dfa4058c5e263123b398ae795573c4e1313c83fe68f93556cd5e8031b3c7d',
  // CN=GlobalSign Root CA — الموقِّع التقاطعي لـR4 المُقدَّم — ينتهي 2028-01-28
  'ebd41040e4bb3ec742c9e381d31ef2a41a48b6685c96e7cef3c1df6cd4331c99',
];

/// أقرب تاريخ انتهاء بين الجذور المثبَّتة (GlobalSign Root CA).
///
/// مُدوَّن هنا لأن [pinningEnforcedUntil] يجب أن يبقى قبله، ويثبّت الاختبار ذلك.
final DateTime earliestPinnedRootExpiry = DateTime.utc(2028, 1, 28);

/// حزمة الجذور بصيغة PEM، كما تُسلَّم إلى `SecurityContext`.
///
/// لا تُحرَّر يدويًّا: أضف بالإجراء الموصوف في شرح المكتبة، وحدِّث
/// [pinnedRootFingerprints] معها.
const String pinnedRootsPem = '''
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlrsWNBCUaqxElqjANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjIwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjIwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQDO3v2m++zsFDQ8BwZabFn3GTXd98GdVarTzTukk3LvCvpt
nfbwhYBboUhSnznFt+4orO/LdmgUud+tAWyZH8QiHZ/+cnfgLFuv5AS/T3KgGjSY
6Dlo7JUle3ah5mm5hRm9iYz+re026nO8/4Piy33B0s5Ks40FnotJk9/BW9BuXvAu
MC6C/Pq8tBcKSOWIm8Wba96wyrQD8Nr0kLhlZPdcTK3ofmZemde4wj7I0BOdre7k
RXuJVfeKH2JShBKzwkCX44ofR5GmdFrS+LFjKBC4swm4VndAoiaYecb+3yXuPuWg
f9RhD1FLPD+M2uFwdNjCaKH5wQzpoeJ/u1U8dgbuak7MkogwTZq9TwtImoS1mKPV
+3PBV2HdKFZ1E66HjucMUQkQdYhMvI35ezzUIkgfKtzra7tEscszcTJGr61K8Yzo
dDqs5xoic4DSMPclQsciOzsSrZYuxsN2B6ogtzVJV+mSSeh2FnIxZyuWfoqjx5RW
Ir9qS34BIbIjMt/kmkRtWVtd9QCgHJvGeJeNkP+byKq0rxFROV7Z+2et1VsRnTKa
G73VululycslaVNVJ1zgyjbLiGH7HrfQy+4W+9OmTN6SpdTi3/UGVN4unUu0kzCq
gc7dGtxRcw1PcOnlthYhGXmy5okLdWTK1au8CcEYof/UVKGFPP0UJAOyh9OktwID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQUu//KjiOfT5nK2+JopqUVJxce2Q4wDQYJKoZIhvcNAQEMBQADggIBAB/Kzt3H
vqGf2SdMC9wXmBFqiN495nFWcrKeGk6c1SuYJF2ba3uwM4IJvd8lRuqYnrYb/oM8
0mJhwQTtzuDFycgTE1XnqGOtjHsB/ncw4c5omwX4Eu55MaBBRTUoCnGkJE+M3DyC
B19m3H0Q/gxhswWV7uGugQ+o+MePTagjAiZrHYNSVc61LwDKgEDg4XSsYPWHgJ2u
NmSRXbBoGOqKYcl3qJfEycel/FVL8/B/uWU9J2jQzGv6U53hkRrJXRqWbTKH7QMg
yALOWr7Z6v2yTcQvG99fevX4i8buMTolUVVnjWQye+mew4K6Ki3pHrTgSAai/Gev
HyICc/sgCq+dVEuhzf9gR7A/Xe8bVr2XIZYtCtFenTgCR2y59PYjJbigapordwj6
xLEokCZYCDzifqrXPW+6MYgKBesntaFJ7qBFVHvmJ2WZICGoo7z7GJa7Um8M7YNR
TOlZ4iBgxcJlkoKM8xAfDoqXvneCbT+PHV28SSe9zE8P4c52hgQjxcCMElv924Sg
JPFI/2R80L5cFtHvma3AH/vLrrw4IgYmZNralw4/KBVEqE8AyvCazM90arQ+POuV
7LXTWtiBmelDGDfrs7vRWGJB82bSj6p4lVQgw1oudCvV0b4YacCs1aTPObpRhANl
6WLAYv7YTVWW4tAR+kg0Eeye7QUd5MjWHYbL
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPluILrIPglJ209ZjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjMwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjMwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AAQfTzOHMymKoYTey8chWEGJ6ladK0uFxh1MJ7x/JlFyb+Kf1qPKzEUURout736G
jOyxfi//qXGdGIRFBEFVbivqJn+7kAHjSxm65FSWRQmx1WyRRK2EE46ajA2ADDL2
4CejQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBTB8Sa6oC2uhYHP0/EqEr24Cmf9vDAKBggqhkjOPQQDAwNpADBmAjEA9uEglRR7
VKOQFhG/hMjqb2sXnh5GmCCbn9MN2azTL818+FsuVbu/3ZL3pAzcMeGiAjEA/Jdm
ZuVDFhOD3cffL74UOO0BzrEXGhF16b0DjyZ+hOXJYKaV11RZt+cRLInUue4X
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkG
A1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jv
b3QgQ0ExGzAZBgNVBAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAw
MDBaFw0yODAxMjgxMjAwMDBaMFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9i
YWxTaWduIG52LXNhMRAwDgYDVQQLEwdSb290IENBMRswGQYDVQQDExJHbG9iYWxT
aWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDaDuaZ
jc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtIK+6NiY6arymAZavp
xy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCOXkNz8kHp
1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG
snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJ
U26Qzns3dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N8
9iFo7+ryUp9/k5DPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E
BTADAQH/MB0GA1UdDgQWBBRge2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0B
AQUFAAOCAQEA1nPnfE920I2/7LqivjTFKDK1fPxsnCwrvQmeU79rXqoRSLblCKOz
yj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY776BQVvnGCv04zcQLcFGUl5gE
38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9LhJIZJrglfCm7ymP
AbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr+WymXUad
DKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME
HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==
-----END CERTIFICATE-----
''';
