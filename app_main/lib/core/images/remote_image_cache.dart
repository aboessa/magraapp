/// تخزين محلّي لصور الـCDN: تُنزَّل مرّة واحدة ثم تعيش على القرص.
///
/// ## المشكلة التي يحلّها هذا الملف
///
/// `Image.network` يُخبّئ **في الذاكرة فقط**. فكلّ صورة أُخرجت من الـAPK إلى R2
/// كانت ستُعاد تنزيلها في كلّ جلسة: استهلاك بيانات متكرّر للعائلة، وشاشة فارغة
/// عند كلّ انقطاع. وهذا الملف هو العقد المقابل لذلك النقل: الصورة تُحمَّل من
/// R2 مرّة، ثم تُقرأ من `getApplicationSupportDirectory()/img_cache/` إلى الأبد.
///
/// ترتيب المصادر عند كلّ طلب: ملفّ محلّي ← شبكة ← بديل مبندل.
///
/// ## لماذا ليس `cached_network_image`
///
/// 1. العميل المثبَّت (`SEC-105`): كلّ اتصال HTTP في التطبيق يمرّ عبر
///    `createAppHttpClient()` بتثبيت شهادات. حزمة جاهزة ستفتح عميلها الخاص
///    خارج التثبيت، فيبقى مسارٌ واحد غير مثبَّت يكفي لقراءة ما يمرّ به.
/// 2. الـCDN مجهول الهوية عمدًا: الصور العامة تُقرأ مباشرةً من الدلو بلا
///    توكن. لا حاجة لطبقة تفويض تتدخّل في كلّ طلب.
/// 3. `decode_cap_test.dart` يطلب `ResizeImage` على كل `Image`: المسار
///    `Image.file` يبقي `cacheWidth` تحت سيطرتنا.
///
/// ## قرارات التصميم
///
/// * المفتاح = `sha256(url)` سداسي عشري: يبتلع `?v=3` وأيّ استعلام cache-buster
///   في المفتاح نفسه بلا معالجة خاصة، وطوله ثابت. يُحفَظ الامتداد الأصلي
///   (`.png`/`.webp`...) ذيلًا للملف لأنّ `flutter_svg` يقرّر المعالج من
///   الامتداد: `SvgPicture` على ملفّ بلا امتداد يفشل.
/// * المجلد `img_cache/` داخل `getApplicationSupportDirectory()`: دعم التطبيق
///   لا المستندات — لا يظهر في معرض الصور ولا يُنسَخ احتياطيًّا بالضرورة.
/// * بلا تشفير: المحتوى عام ومجهول الهوية أصلًا (دلو `majarra-thumbs` عام).
///   طبقة التنزيلات المشفّرة (`features/downloads/`) للأصوات والفيديو المدفوع؛
///   تشفير صور عامة تكلفة بلا مكسب.
/// * التحقق المشروط: `ETag` يُحفَظ في ملفّ جانبي `.etag` ويُرسَل
///   `If-None-Match` في الزيارة التالية. ردّ `304` يعني «نسختك صالحة» فيُعاد
///   الملفّ المحلّي دون كتابة. لا `Last-Modified` هنا لأنّ R2/CDN يُصدِر `ETag`
///   دائمًا والمسار الواحد أدقّ من مسارين.
/// * الإخلاء LRU بسقف بايتات لا بعدد: صور CDN متفاوتة الأحجام (غلاف 126KB
///   مقابل عائق 451KB)، وسقفٌ بالعدد يُخلي الصغار ويُبقي الكبار. السقف
///   الافتراضي 150MB: كافٍ لآلاف الصور (بمتوسط 100KB) وأصغر من حدّ التنزيلات
///   (2GB) بكثير لأنه محتوى مجاني متاح دائمًا على الشبكة.
/// * حدّ الحماية: `maxFileBytes` (10MB) يرفض كتابة ملفّ شاذ قبل أن يلتهم
///   السقف وحده. صورة واجهة لا تتجاوز هذا أبدًا؛ ما يتجاوزه خطأ أو عبث.
/// * الدليل `index.json`: أسماء الملفات مشتقّة من المحتوى لا من زمن الوصول،
///   فبديل «الأقدم زمن تعديل» يكذب. الدليل يحفظ `lastUsed` لكلّ مفتاح.
/// * الإخلاء عند **الكتابة فقط**: القراءة لا تُخلي أبدًا. وإلّا صارت الصورة
///   التي تُعرض الآن قابلة للحذف أثناء عرضها، وكلّ قراءة تدفع ثمن مسحٍ كامل.
/// * الفشل صامت هنا وصاخب عند العارض: تُعيد `null`، والعارض (`CinematicImage`
///   / `DrawingAsset`) هو من يرسم البديل ويسجّل التشخيص. طبقة التخزين لا تملك
///   سياق بناء فلا ترسم، وتسجيلها المفرط كان سيُغرق السجلّ بكلّ انقطاع شبكة.
///
/// ## ما لا يفعله هذا الملف
///
/// * لا سياسة انتهاء زمنية: الصورة الصالحة اليوم صالحة غدًا ما دام `ETag`
///   مطابقًا. انتهاءٌ زمني كان سيعيد تنزيل صور لم تتغيّر.
/// * لا حذف استباقي عند نقص المساحة العامة: السقف الداخلي هو الضمان الوحيد.
///   التنزيلات ترفض عند الامتلاء (`DownloadRejection.storageFull`) لأن محتواها
///   مدفوع ومحمي برخصة؛ الصور العامة تُعوَّض من الشبكة فتُخلى.
/// * لا طلبات `HEAD`: التحقق يحدث ضمن `GET` الشرطي نفسه، فلا رحلة إضافية.
library;

import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../env/app_environment.dart';
import '../network/secure_http_client.dart';

/// نتيجة جلب صورة: ملفّ محلّي صالح للعرض، أو لا شيء.
///
/// `revalidated` للتشخيص: هل أكّدت الشبكة صلاحية النسخة المحلّية (`304`)؟
/// `downloaded` هل نُزّلت بايتات جديدة؟ كلاهما `false` تعني «قُرئت من القرص
/// بلا أيّ اتصال» — وهي الحالة الشائعة بعد أوّل تحميل.
class CachedRemoteImage {
  const CachedRemoteImage({
    required this.file,
    required this.revalidated,
    required this.downloaded,
  });

  final File file;
  final bool revalidated;
  final bool downloaded;
}

/// تخزين صور الـCDN على القرص مع إعادة تحقق شرطية وإخلاء LRU.
///
/// للاختبار: تُحقَن كلّ الاعتماديات الخارجية (العميل، مجلد الجذر، الساعة) عبر
/// الباني. الإنتاج يستخدم الافتراضيات: العميل المثبَّت ودعم التطبيق.
class RemoteImageCache {
  RemoteImageCache({
    http.Client? httpClient,
    Directory? rootDir,
    DateTime Function()? now,
    this.maxTotalBytes = 150 * 1024 * 1024,
    this.maxFileBytes = 10 * 1024 * 1024,
  }) : _client = httpClient ?? createAppHttpClient(),
       _rootOverride = rootDir,
       _now = now ?? DateTime.now;

  final http.Client _client;
  final Directory? _rootOverride;
  final DateTime Function() _now;

  /// سقف التخزين الإجمالي. تجاوُزه عند الكتابة يُخلي الأقلّ استعمالًا أوّلًا.
  final int maxTotalBytes;

  /// أكبر ملفّ مسموح بكتابته. ما يتجاوزه يُرفَض قبل الكتابة لا بعدها.
  final int maxFileBytes;

  /// مضيف الـCDN الوحيد المقبول. ليس `startsWith` على السلسلة: `evil-cdn...`
  /// يبدأ بالنطاق ولا يملكه. المقارنة على `Uri.host` بالمساواة التامة.
  static bool isCacheableUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    if (uri.scheme != 'https') return false;
    return uri.host == AppConfig.assetHost;
  }

  /// مفتاح القرص لـ[url]: بصمة ثابتة الطول تمتصّ أيّ استعلام (`?v=3`).
  static String keyForUrl(String url) => sha256.convert(utf8.encode(url)).toString();

  /// امتداد يُلحَق بالمفتاح لأنّ `flutter_svg` يقرّر المعالج من الامتداد.
  ///
  /// يُؤخَذ من مسار الـURL لا من `Content-Type`: الاستجابة قد تأتي بلا نوع أو
  /// بنوعٍ عام (`application/octet-stream`)، والامتداد في مفتاح R2 مصدرٌ أدقّ.
  /// غير المعروف يُعامَل `.bin` فيُرفَض لاحقًا بدل أن يُسمَّى `.png` كذبًا.
  static String extensionForUrl(String url) {
    final path = Uri.tryParse(url)?.path.toLowerCase() ?? '';
    if (path.endsWith('.svg')) return '.svg';
    if (path.endsWith('.webp')) return '.webp';
    if (path.endsWith('.png')) return '.png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return '.jpg';
    if (path.endsWith('.gif')) return '.gif';
    return '.bin';
  }

  Future<Directory> _root() async {
    if (_rootOverride != null) {
      await _rootOverride.create(recursive: true);
      return _rootOverride;
    }
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/img_cache');
    await dir.create(recursive: true);
    return dir;
  }

  File _fileFor(Directory root, String key, String ext) =>
      File('${root.path}/$key$ext');

  File _etagFor(Directory root, String key) => File('${root.path}/$key.etag');

  File _indexFile(Directory root) => File('${root.path}/index.json');

  /// يجلب [url] مرتبة المصادر: قرص ← شبكة ← لا شيء.
  ///
  /// تُعيد `null` حين لا يوجد ملفّ صالح ولا شبكة صالحة: العارض هو من يرسم
  /// البديل المبندل. لا ترمي استثناءً أبدًا — فشل التخزين لا يجوز أن يكسر شاشة.
  Future<CachedRemoteImage?> fetch(String url) async {
    if (!isCacheableUrl(url)) return null;
    final key = keyForUrl(url);
    final ext = extensionForUrl(url);
    if (ext == '.bin') return null;

    late final Directory root;
    try {
      root = await _root();
    } catch (_) {
      return null;
    }
    final file = _fileFor(root, key, ext);

    // 1) القرص أوّلًا — لكن بشرط الوجود والحجم.
    //
    // ملفّ صفريّ ليس «مخزّنًا»: هو بقايا كتابة ماتت في منتصفها (قتل التطبيق،
    // امتلاء القرص). اعتباره صالحًا كان سيُثبّت صورةً مكسورة إلى الأبد لأنّ
    // مسار القراءة لا يتحقّق من الشبكة.
    final exists = await file.exists();
    if (exists && await file.length() > 0) {
      await _touch(root, key);
      return CachedRemoteImage(
        file: file,
        revalidated: false,
        downloaded: false,
      );
    }

    // 2) الشبكة مع إعادة تحقق شرطية.
    //
    // الـ`ETag` الجانبي قد يخصّ امتدادًا قديمًا لنفس الـURL (تغيّر المفتاح في
    // R2 من `.png` إلى `.webp`)، فيُرئسل كما هو: صدقُه يحدّده الخادم لا نحن،
    // والخادم وحده يملك الردّ `304` أو `200` جديد.
    try {
      final etagFile = _etagFor(root, key);
      final savedEtag = await etagFile.exists()
          ? (await etagFile.readAsString()).trim()
          : '';
      final request = http.Request('GET', Uri.parse(url));
      if (savedEtag.isNotEmpty) {
        request.headers['If-None-Match'] = savedEtag;
      }
      final streamed = await _client
          .send(request)
          .timeout(const Duration(seconds: 20));

      // `304`: نسختنا صالحة. لا بايتات في الجسد ولا كتابة على القرص.
      if (streamed.statusCode == 304) {
        if (await file.exists() && await file.length() > 0) {
          await _touch(root, key);
          await streamed.stream.drain<void>();
          return CachedRemoteImage(
            file: file,
            revalidated: true,
            downloaded: false,
          );
        }
        // `304` بلا ملفّ محلّي تناقض: الـ`ETag` يخصّ نسخة ضاعت. لا نثق به،
        // نسقطه ونعيد المحاولة بلا شرط لتنزيل النسخة كاملة.
        await streamed.stream.drain<void>();
        await _safeDelete(etagFile);
        return fetch(url);
      }

      if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
        await streamed.stream.drain<void>();
        return null;
      }

      // 3) الكتابة: تُجمَع في الذاكرة أوّلًا ثم تُكتَب دفعة واحدة.
      //
      // البديل — الكتابة أثناء الاستقبال — يترك ملفًّا نصفيًّا عند كلّ انقطاع،
      // ومسار القراءة أعلاه سيرفضه في المرّة التالية فيُعاد التنزيل كاملًا:
      // فشلٌ صامت يتكرّر. أمّا الرفض المسبق بالحجم فيمنع ملفًّا شاذًّا واحدًا
      // من التهام السقف كلّه قبل أن يبدأ الإخلاء.
      final bytes = await streamed.stream
          .fold<List<int>>(<int>[], (acc, chunk) => acc..addAll(chunk));
      if (bytes.isEmpty || bytes.length > maxFileBytes) return null;

      await _evictFor(root, bytes.length, excludeKey: key);
      await file.writeAsBytes(bytes, flush: true);
      final etag = streamed.headers['etag'];
      if (etag != null && etag.isNotEmpty) {
        await etagFile.writeAsString(etag, flush: true);
      }
      await _touch(root, key);
      return CachedRemoteImage(
        file: file,
        revalidated: false,
        downloaded: true,
      );
    } catch (_) {
      return null;
    }
  }

  /// يقرأ الدليل: مفتاح ← آخر استعمال (ملّي ثانية منذ العصر).
  Future<Map<String, int>> _readIndex(Directory root) async {
    try {
      final raw = await _indexFile(root).readAsString();
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return {};
      return decoded.map<String, int>(
        (key, value) => MapEntry(
          key.toString(),
          value is int ? value : 0,
        ),
      );
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeIndex(Directory root, Map<String, int> index) async {
    try {
      await _indexFile(root).writeAsString(jsonEncode(index), flush: true);
    } catch (_) {
      // الدليل مساعد: ضياعه يعني إخلاءً أغبى لا صورًا مكسورة.
    }
  }

  /// يُحدّث زمن آخر استعمال للمفتاح. القراءة والإخلاء يعتمدان عليه.
  Future<void> _touch(Directory root, String key) async {
    final index = await _readIndex(root);
    index[key] = _now().millisecondsSinceEpoch;
    await _writeIndex(root, index);
  }

  /// يُخلي الأقلّ استعمالًا حتى تتّسع [needed] بايتات.
  ///
  /// `[excludeKey]` يُستثنَى لأنّ الإخلاء يحدث قبل كتابة الملفّ الجديد: بدونه
  /// كان الملفّ القديم لنفس الـURL (امتدادٌ تغيّر) أول ضحية دائمًا، فيُحذَف
  /// ثم يُكتَب من جديد — إخلاءٌ بلا مكسب. ملفّات `.etag` اليتيمة (بلا صورة)
  /// تُكنَس هنا أيضًا: لا معنى للتحقق من نسخة لا نملكها.
  Future<void> _evictFor(
    Directory root,
    int needed, {
    required String excludeKey,
  }) async {
    final entities = await root
        .list()
        .where((e) => e is File)
        .cast<File>()
        .toList();
    int total = 0;
    final sized = <_SizedEntry>[];
    for (final file in entities) {
      final name = file.path.split(Platform.pathSeparator).last;
      if (name == 'index.json') continue;
      int size = 0;
      try {
        size = await file.length();
      } catch (_) {
        continue;
      }
      total += size;
      final isEtag = name.endsWith('.etag');
      final key = isEtag
          ? name.substring(0, name.length - '.etag'.length)
          : name.contains('.')
                ? name.substring(0, name.lastIndexOf('.'))
                : name;
      sized.add(_SizedEntry(file, size, key, !isEtag));
    }

    // كنس اليتامى أوّلًا: `.etag` بلا صورة شقيقه.
    final imageKeys = {
      for (final entry in sized)
        if (entry.isImage) entry.key,
    };
    for (final entry in sized) {
      if (!entry.isImage && !imageKeys.contains(entry.key)) {
        await _safeDelete(entry.file);
        total -= entry.size;
      }
    }

    if (total + needed <= maxTotalBytes) return;

    final index = await _readIndex(root);
    final candidates = sized
        .where((entry) => entry.isImage && entry.key != excludeKey)
        .toList()
      ..sort((a, b) {
        final ta = index[a.key] ?? 0;
        final tb = index[b.key] ?? 0;
        return ta.compareTo(tb);
      });

    final touched = Map<String, int>.of(index);
    for (final victim in candidates) {
      if (total + needed <= maxTotalBytes) break;
      await _safeDelete(victim.file);
      await _safeDelete(_etagFor(root, victim.key));
      total -= victim.size;
      touched.remove(victim.key);
    }
    await _writeIndex(root, touched);
  }

  Future<void> _safeDelete(File file) async {
    try {
      if (await file.exists()) await file.delete();
    } catch (_) {
      // الإخلاء بذل جهد: ملفٌّ مُقفَل يُحاوَل في المرّة التالية.
    }
  }
}

/// صفّ إخلاء واحد: ملفّ وحجمه ومفتاحه وهل هو صورة أم `.etag` جانبي.
///
/// صنفٌ مُسمَّى لا سجلًّا (`record`): حقول السجلّ غير قابلة للتسمية في سياق
/// الاستعمال هنا عبر الخصائص، والصنف يُبقي `entry.file` و`entry.key` مقروءة
/// ومستقرّة عبر إصدارات Dart.
class _SizedEntry {
  const _SizedEntry(this.file, this.size, this.key, this.isImage);

  final File file;
  final int size;
  final String key;
  final bool isImage;
}
