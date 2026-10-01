import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart' show NumberFormat;

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/billing_status.dart';
import '../../data/manual_payment.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// Pay by mobile wallet (Vodafone Cash, …) or InstaPay.
///
/// The parent transfers the amount shown, then reports it here with the number
/// they paid from. An operator checks the transfer and approves it, and the
/// plan is activated with a notification. The amount comes from the server;
/// nothing typed here changes what is granted.
class ManualPaymentSection extends ConsumerStatefulWidget {
  const ManualPaymentSection({
    super.key,
    required this.options,
    required this.status,
  });

  final ManualPaymentOptions options;
  final BillingStatus status;

  @override
  ConsumerState<ManualPaymentSection> createState() =>
      _ManualPaymentSectionState();
}

class _ManualPaymentSectionState extends ConsumerState<ManualPaymentSection> {
  bool _busy = false;

  void _refresh() {
    ref.invalidate(manualPaymentOptionsProvider);
    ref.invalidate(billingStatusProvider);
  }

  void _toast(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openSheet() async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => _ManualPaymentSheet(options: widget.options),
    );
    if (sent == true && mounted) {
      _refresh();
      _toast(AppLocalizationsAr().profilemanualpaymentsectionText01);
    }
  }

  Future<void> _attachReceipt(ManualPaymentRequest request) async {
    final picked = await _pickReceipt();
    if (picked == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(majarraApiClientProvider)
          .uploadManualPaymentReceipt(
            requestId: request.id,
            bytes: picked.bytes,
            mimeType: picked.mimeType,
          );
      if (!mounted) return;
      _refresh();
      _toast(AppLocalizationsAr().profilemanualpaymentsectionText02);
    } catch (error) {
      if (mounted) _toast(_errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(ManualPaymentRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(AppLocalizationsAr().profilemanualpaymentsectionText03),
        content: Text(AppLocalizationsAr().profilemanualpaymentsectionText04),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(AppLocalizationsAr().profilemanualpaymentsectionText05),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(AppLocalizationsAr().profilemanualpaymentsectionText06),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(majarraApiClientProvider).cancelManualPayment(request.id);
      if (mounted) _refresh();
    } catch (error) {
      if (mounted) _toast(_errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = widget.options.pending;
    final latest = widget.options.latest;
    final paid = widget.status.plan.isPaid;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color(0xFF111A3A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.starGold.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.account_balance_wallet_outlined,
                color: AppColors.starGold,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  paid
                      ? AppLocalizationsAr().profilemanualpaymentsectionText07
                      : AppLocalizationsAr().profilemanualpaymentsectionText08,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 6),
          Text(
            widget.options.methods.map((m) => m.label).join(' · '),
            style: TextStyle(color: AppColors.mutedText, fontSize: 12),
          ),
          SizedBox(height: 12),
          if (pending != null)
            _PendingNotice(
              request: pending,
              busy: _busy,
              onAttach: pending.hasReceipt
                  ? null
                  : () => _attachReceipt(pending),
              onCancel: () => _cancel(pending),
            )
          else ...[
            if (latest?.status == 'rejected')
              _Notice(
                icon: Icons.error_outline_rounded,
                color: AppColors.danger,
                text:
                    // ignore: prefer_interpolation_to_compose_strings
                    AppLocalizationsAr().profilemanualpaymentsectionText09 +
                    '${latest?.rejectReason == null ? '' : ': ${latest!.rejectReason}'}. ' +
                    AppLocalizationsAr().profilemanualpaymentsectionText10,
              ),
            if (paid && widget.status.subscription?.source == 'manual')
              Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: Text(
                  AppLocalizationsAr().profilemanualpaymentsectionText11,
                  style: TextStyle(
                    color: AppColors.mutedText,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ),
            FilledButton.icon(
              onPressed: _busy ? null : _openSheet,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: AppColors.starGold,
                foregroundColor: AppColors.deepSpace,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              icon: Icon(Icons.send_to_mobile_rounded),
              label: Text(
                paid
                    ? AppLocalizationsAr().profilemanualpaymentsectionText12
                    : AppLocalizationsAr().profilemanualpaymentsectionText13,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PendingNotice extends StatelessWidget {
  const _PendingNotice({
    required this.request,
    required this.busy,
    required this.onAttach,
    required this.onCancel,
  });

  final ManualPaymentRequest request;
  final bool busy;
  final VoidCallback? onAttach;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Notice(
          icon: Icons.hourglass_top_rounded,
          color: AppColors.electricCyan,
          text:
              // ignore: prefer_interpolation_to_compose_strings
              AppLocalizationsAr().profilemanualpaymentsectionBuild01(
                request.amountEgp,
                request.plan.label,
              ) +
              AppLocalizationsAr().profilemanualpaymentsectionBuild02,
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (onAttach != null)
              OutlinedButton.icon(
                onPressed: busy ? null : onAttach,
                icon: Icon(Icons.receipt_long_outlined),
                label: Text(
                  AppLocalizationsAr().profilemanualpaymentsectionBuild03,
                ),
              ),
            TextButton(
              onPressed: busy ? null : onCancel,
              child: Text(
                AppLocalizationsAr().profilemanualpaymentsectionText14,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12.5,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Choose plan and method, see where to send, then report the transfer.
class _ManualPaymentSheet extends ConsumerStatefulWidget {
  const _ManualPaymentSheet({required this.options});

  final ManualPaymentOptions options;

  @override
  ConsumerState<_ManualPaymentSheet> createState() =>
      _ManualPaymentSheetState();
}

class _ManualPaymentSheetState extends ConsumerState<_ManualPaymentSheet> {
  late ManualPaymentOffer _offer = widget.options.offers.first;
  late ManualPaymentMethod _method = widget.options.methods.first;
  final _sender = TextEditingController();
  final _reference = TextEditingController();
  _PickedReceipt? _receipt;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _sender.dispose();
    _reference.dispose();
    super.dispose();
  }

  bool get _canSend =>
      !_sending &&
      _sender.text.trim().length >= 3 &&
      (!widget.options.receiptRequired || _receipt != null);

  Future<void> _submit() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    final api = ref.read(majarraApiClientProvider);
    try {
      final created = await api.submitManualPayment(
        plan: _offer.planKey,
        period: _offer.period,
        method: _method.code,
        sender: _sender.text.trim(),
        reference: _reference.text.trim(),
      );
      final data = created['data'];
      final id = data is Map ? data['id'] : null;
      final receipt = _receipt;
      if (receipt != null && id is String) {
        try {
          await api.uploadManualPaymentReceipt(
            requestId: id,
            bytes: receipt.bytes,
            mimeType: receipt.mimeType,
          );
        } catch (_) {
          // The report itself went through; the parent can attach the receipt
          // again from the pending notice.
        }
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = _errorText(error);
        });
      }
    }
  }

  Future<void> _pick() async {
    final picked = await _pickReceipt();
    if (picked != null && mounted) setState(() => _receipt = picked);
  }

  @override
  Widget build(BuildContext context) {
    final options = widget.options;
    final amount = NumberFormat.decimalPattern(
      'ar_EG',
    ).format(_offer.amountEgp);
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 14,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 18,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            SizedBox(height: 14),
            _SheetLabel(AppLocalizationsAr().profilemanualpaymentsectionText15),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final offer in options.offers)
                  ChoiceChip(
                    label: Text(
                      AppLocalizationsAr().profilemanualpaymentsectionText16(
                        offer.plan.label,
                        offer.amountEgp,
                        offer.periodLabel,
                      ),
                    ),
                    selected: identical(offer, _offer),
                    onSelected: (_) => setState(() => _offer = offer),
                  ),
              ],
            ),
            SizedBox(height: 16),
            _SheetLabel(AppLocalizationsAr().profilemanualpaymentsectionText17),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final method in options.methods)
                  ChoiceChip(
                    label: Text(method.label),
                    selected: identical(method, _method),
                    onSelected: (_) => setState(() => _method = method),
                  ),
              ],
            ),
            SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.indigoSurface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLocalizationsAr().profilemanualpaymentsectionText18(
                      amount,
                      _method.label,
                    ),
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          _method.account,
                          textDirection: TextDirection.ltr,
                          style: TextStyle(
                            color: AppColors.starGold,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: AppLocalizationsAr()
                            .profilemanualpaymentsectionTooltip01,
                        icon: Icon(Icons.copy_rounded, color: Colors.white),
                        onPressed: () {
                          Clipboard.setData(
                            ClipboardData(text: _method.account),
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                AppLocalizationsAr()
                                    .profilemanualpaymentsectionText19,
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  if (_method.holder.isNotEmpty)
                    Text(
                      AppLocalizationsAr().profilemanualpaymentsectionText20(
                        _method.holder,
                      ),
                      style: TextStyle(
                        color: AppColors.mutedText,
                        fontSize: 12,
                      ),
                    ),
                  if (options.instructions.isNotEmpty) ...[
                    SizedBox(height: 6),
                    Text(
                      options.instructions,
                      style: TextStyle(
                        color: AppColors.mutedText,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(height: 16),
            _SheetLabel(AppLocalizationsAr().profilemanualpaymentsectionText21),
            TextField(
              controller: _sender,
              keyboardType: _method.isInstaPay
                  ? TextInputType.text
                  : TextInputType.phone,
              textDirection: TextDirection.ltr,
              maxLength: 60,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: _method.isInstaPay
                    ? AppLocalizationsAr().profilemanualpaymentsectionText22
                    : AppLocalizationsAr().profilemanualpaymentsectionText23,
                counterText: '',
              ),
            ),
            SizedBox(height: 8),
            TextField(
              controller: _reference,
              textDirection: TextDirection.ltr,
              maxLength: 60,
              decoration: InputDecoration(
                labelText:
                    AppLocalizationsAr().profilemanualpaymentsectionLabelText01,
                counterText: '',
              ),
            ),
            SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _sending ? null : _pick,
              icon: Icon(
                _receipt == null
                    ? Icons.add_photo_alternate_outlined
                    : Icons.check_circle_rounded,
              ),
              label: Text(
                _receipt == null
                    ? (options.receiptRequired
                          ? AppLocalizationsAr()
                                .profilemanualpaymentsectionText24
                          : AppLocalizationsAr()
                                .profilemanualpaymentsectionText25)
                    : AppLocalizationsAr().profilemanualpaymentsectionText26,
              ),
            ),
            if (_error != null) ...[
              SizedBox(height: 10),
              Text(
                _error!,
                style: TextStyle(color: AppColors.danger, fontSize: 12.5),
              ),
            ],
            SizedBox(height: 14),
            FilledButton(
              onPressed: _canSend ? _submit : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: AppColors.starGold,
                foregroundColor: AppColors.deepSpace,
              ),
              child: _sending
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.deepSpace,
                      ),
                    )
                  : Text(
                      AppLocalizationsAr().profilemanualpaymentsectionText27,
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
            ),
            SizedBox(height: 8),
            Text(
              // ignore: prefer_interpolation_to_compose_strings
              AppLocalizationsAr().profilemanualpaymentsectionText28(
                    _offer.days,
                  ) +
                  AppLocalizationsAr().profilemanualpaymentsectionText29,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.dimText,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetLabel extends StatelessWidget {
  const _SheetLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      text,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _PickedReceipt {
  const _PickedReceipt(this.bytes, this.mimeType);

  final Uint8List bytes;
  final String mimeType;
}

final _maxReceiptBytes = 3 * 1024 * 1024;

/// Gallery pick, re-encoded smaller. The type is read from the bytes, which is
/// what the server checks too.
Future<_PickedReceipt?> _pickReceipt() async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    maxWidth: 1600,
    maxHeight: 1600,
    imageQuality: 80,
  );
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  if (bytes.isEmpty || bytes.length > _maxReceiptBytes) return null;
  final mime = receiptMimeType(bytes);
  return mime == null ? null : _PickedReceipt(bytes, mime);
}

/// JPEG, PNG or WebP by magic bytes, or null.
@visibleForTesting
String? receiptMimeType(Uint8List b) {
  bool starts(List<int> magic, [int offset = 0]) {
    if (b.length < offset + magic.length) return false;
    for (var i = 0; i < magic.length; i++) {
      if (b[offset + i] != magic[i]) return false;
    }
    return true;
  }

  if (starts([0xFF, 0xD8, 0xFF])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4E, 0x47])) return 'image/png';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}

String _errorText(Object error) {
  if (error is MajarraApiException) {
    switch (error.statusCode) {
      case 409:
        return AppLocalizationsAr().profilemanualpaymentsectionText30;
      case 429:
        return AppLocalizationsAr().profilemanualpaymentsectionText31;
      case 403:
        return AppLocalizationsAr().profilemanualpaymentsectionText32;
      case 413 || 415:
        return AppLocalizationsAr().profilemanualpaymentsectionText33;
      case 503:
        return AppLocalizationsAr().profilemanualpaymentsectionText34;
    }
  }
  return AppFailure.fromException(error).message;
}
