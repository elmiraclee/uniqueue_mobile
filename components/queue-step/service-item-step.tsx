import { TourTarget } from '@/components/tutorial/tutorial';
import { clientAlert } from '@/components/client/client-ui';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';
import SelectDropdown from '../ui/select-dropdown';
import { AcademicMap } from './academic-step';
import { ChoiceMap } from './choice-step';
import PriorityStep from './priority-step';

export interface ServiceItem {
  id: number;
  name: string;
  requirements: string[];
  category?: string;
  amount?: number | null;
  price?: number | null;
  pay_at_cashier?: boolean;
  use_academic_period?: boolean;
  has_choices?: boolean;
  choices?: { id: number; label: string }[];
}

interface Props {
  service_items: ServiceItem[];
  selectedServiceItems: number[];
  setSelectedServiceItems: React.Dispatch<React.SetStateAction<number[]>>;

  quantities: Record<number, number>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<number, number>>>;

  priority: boolean;
  setPriority: (value: boolean) => void;
  priorityReason: string;
  setPriorityReason: (text: string) => void;
  priorityEnabled: boolean;

  /* Per-item option (e.g. size) — shown inline, same as the web wizard. */
  itemChoices: ChoiceMap;
  setItemChoices: React.Dispatch<React.SetStateAction<ChoiceMap>>;

  /* Academic period + school year, per copy — also inline, so the whole
     wizard stays at 4 steps just like student-queue.php on the web. */
  academic: AcademicMap;
  setAcademic: React.Dispatch<React.SetStateAction<AcademicMap>>;
  periods: { id: number; label: string }[];
  schoolYears: { id: number; school_year: string }[];

  academicLoading?: boolean;
  academicError?: string;
  onRetryAcademic?: () => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ServiceItemStep({
  service_items,
  selectedServiceItems,
  setSelectedServiceItems,
  quantities,
  setQuantities,
  priority,
  setPriority,
  priorityReason,
  setPriorityReason,
  priorityEnabled,
  itemChoices,
  setItemChoices,
  academic,
  setAcademic,
  periods,
  schoolYears,
  academicLoading = false,
  academicError = '',
  onRetryAcademic,
  onNext,
  onBack,
}: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    service_items.forEach((item) => {
      set.add(item.category?.trim() || 'General');
    });
    return ['All', ...Array.from(set).sort()];
  }, [service_items]);

  const [categoryFilter, setCategoryFilter] = useState('All');

  const visibleItems = useMemo(() => {
    if (categoryFilter === 'All') return service_items;
    return service_items.filter(
      (item) => (item.category?.trim() || 'General') === categoryFilter
    );
  }, [service_items, categoryFilter]);

  const toggle = (id: number) => {
    if (selectedServiceItems.includes(id)) {
      setSelectedServiceItems(selectedServiceItems.filter((item) => item !== id));
      setQuantities((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelectedServiceItems([...selectedServiceItems, id]);
      setQuantities((prev) => ({ ...prev, [id]: prev[id] || 1 }));
    }
  };

  const updateQuantity = (id: number, action: 'add' | 'minus') => {
    const current = quantities[id] || 1;
    let newQty = current;
    if (action === 'add') newQty = Math.min(20, current + 1);
    if (action === 'minus' && current > 1) newQty--;
    setQuantities({ ...quantities, [id]: newQty });
    if (sameForAll[id]) setAcademic(prev=>{const first=prev[id]?.[0]||{period:'',school_year:''};return {...prev,[id]:Array.from({length:newQty},()=>({...first}))}});
    else setAcademic(prev=>({...prev,[id]:(prev[id]||[]).slice(0,newQty)}));
  };

  const itemHasChoices = (item: ServiceItem) =>
    !!item.has_choices || (item.choices?.length ?? 0) > 0;

  const itemNeedsAcademic = (item: ServiceItem) =>
    !!item.use_academic_period;

  // School years are newest-first so the current year is one tap away,
  // while periods keep the office's configured display order.
  const periodOptions = useMemo(
    () => periods.map((p) => ({ value: p.label, label: p.label })),
    [periods]
  );
  const schoolYearOptions = useMemo(
    () =>
      [...schoolYears]
        .sort((a, b) => b.school_year.localeCompare(a.school_year))
        .map((y) => ({ value: y.school_year, label: y.school_year })),
    [schoolYears]
  );

  // "Same for all copies" per item — mirrors the web checkbox.
  const [sameForAll, setSameForAll] = useState<Record<number, boolean>>({});

  const academicRows = (itemId: number) => {
    const qty = quantities[itemId] || 1;
    const rows = [...(academic[itemId] || [])];
    while (rows.length < qty) rows.push({ period: '', school_year: '' });
    return rows.slice(0, qty);
  };

  const setAcademicField = (
    itemId: number,
    copyIdx: number,
    field: 'period' | 'school_year',
    value: string
  ) => {
    const rows = academicRows(itemId);
    if (sameForAll[itemId]) {
      setAcademic((prev) => ({
        ...prev,
        [itemId]: rows.map((r) => ({ ...r, [field]: value })),
      }));
      return;
    }
    rows[copyIdx] = { ...rows[copyIdx], [field]: value };
    setAcademic((prev) => ({ ...prev, [itemId]: rows }));
  };

  const toggleSameForAll = (itemId: number) => {
    const turningOn = !sameForAll[itemId];
    setSameForAll((prev) => ({ ...prev, [itemId]: turningOn }));
    if (turningOn) {
      const rows = academicRows(itemId);
      const first = rows[0] || { period: '', school_year: '' };
      setAcademic((prev) => ({ ...prev, [itemId]: rows.map(() => ({ ...first })) }));
    }
  };

  const formatAmount = (item: ServiceItem) => {
    const val = item.amount ?? item.price;
    if (val == null) return null;
    return `₱${Number(val).toFixed(2)}`;
  };

  const next = () => {
    if (selectedServiceItems.length === 0) {
      clientAlert('Required', 'Select at least one service item.');
      return;
    }
    if (priorityEnabled && priority && !priorityReason.trim()) {
      clientAlert('Required', 'Please enter a reason for priority lane.');
      return;
    }

    const selected = service_items.filter((i) =>
      selectedServiceItems.includes(i.id)
    );

    const missingChoice = selected.find(
      (i) => itemHasChoices(i) && !itemChoices[i.id]?.choice_id
    );
    if (missingChoice) {
      clientAlert('Required', `Please choose an option for "${missingChoice.name}".`);
      return;
    }

    if (selected.some(itemNeedsAcademic) && (academicLoading || academicError || !periods.length || !schoolYears.length)) {
      clientAlert('Academic details unavailable', academicLoading ? 'Academic options are loading.' : academicError || 'No valid periods and school years are configured. Ask the office to update them.');
      return;
    }

    const missingAcademic = selected.find((i) => {
      if (!itemNeedsAcademic(i)) return false;
      const qty = quantities[i.id] || 1;
      const rows = academic[i.id] || [];
      if (rows.length < qty) return true;
      return rows.slice(0, qty).some((r) => !r.period || !r.school_year);
    });
    if (missingAcademic) {
      clientAlert(
        'Required',
        `Please select the period and school year for "${missingAcademic.name}".`
      );
      return;
    }

    onNext();
  };

  return (
    <View>
      <Text style={styles.title}>Select service items</Text>
      {(academicLoading || !!academicError) && <View style={{ padding: 12, gap: 8, backgroundColor: '#fff3e0' }}>
        <Text accessibilityRole="alert">{academicLoading ? 'Loading academic options…' : academicError}</Text>
        {!academicLoading && !!onRetryAcademic && <TouchableOpacity accessibilityRole="button" onPress={onRetryAcademic}><Text style={{ color: COLORS.primary, fontWeight: '700', paddingVertical: 12 }}>Retry academic options</Text></TouchableOpacity>}
      </View>}
      <Text style={styles.subtitle}>
        Choose the service item or service you need from this office.
      </Text>

      {categories.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(cat)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {visibleItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No service items in this category.
          </Text>
        </View>
      ) : (
        visibleItems.map((item) => {
          const isSelected = selectedServiceItems.includes(item.id);
          const amountLabel = formatAmount(item);

          return (
            <View
              key={item.id}
              style={[styles.card, isSelected && styles.selected]}
            >
              <TourTarget id={`service-${item.id}`}><TouchableOpacity
                style={styles.cardRow}
                onPress={() => toggle(item.id)}
              >
                <View
                  style={[styles.checkbox, isSelected && styles.checkboxActive]}
                >
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>

                <View style={styles.cardTextCol}>
                  <Text style={styles.cardText}>{item.name}</Text>
                  <View style={styles.metaRow}>
                    {!!item.category && item.category !== 'General' && (
                      <Text style={styles.metaChip}>{item.category}</Text>
                    )}
                    {amountLabel && (
                      <Text style={styles.amountText}>{amountLabel}</Text>
                    )}
                    {item.pay_at_cashier && (
                      <Text style={styles.cashierChip}>Pay at cashier</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity></TourTarget>

              {isSelected && (
                <TourTarget id={`quantity-${item.id}`}><View style={styles.qtyContainer}>
                  <Text style={styles.qtyLabel}>Copies</Text>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={[
                        styles.qtyButton,
                        (quantities[item.id] || 1) <= 1 &&
                          styles.qtyButtonDisabled,
                      ]}
                      onPress={() => updateQuantity(item.id, 'minus')}
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>
                      {quantities[item.id] || 1}
                    </Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(item.id, 'add')}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View></TourTarget>
              )}

              {isSelected && itemHasChoices(item) && (
                <View style={styles.inlineBlock}>
                  <Text style={styles.inlineHeader}>Choose an option</Text>
                  <View style={styles.choicePills}>
                    {(item.choices || []).map((ch) => {
                      const active = itemChoices[item.id]?.choice_id === ch.id;
                      return (
                        <TouchableOpacity
                          key={ch.id}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() =>
                            setItemChoices((prev) => ({
                              ...prev,
                              [item.id]: { choice_id: ch.id, choice_label: ch.label },
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && styles.pillTextActive,
                            ]}
                          >
                            {ch.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {isSelected && itemNeedsAcademic(item) && (
                <TourTarget id={`academic-${item.id}`}><View style={styles.inlineBlock}>
                  <Text style={styles.inlineHeader}>Academic details</Text>

                  {(quantities[item.id] || 1) > 1 && (
                    <TouchableOpacity
                      style={styles.sameRow}
                      onPress={() => toggleSameForAll(item.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.smallCheckbox,
                          sameForAll[item.id] && styles.checkboxActive,
                        ]}
                      >
                        {sameForAll[item.id] && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.sameText}>
                        Use the same period and school year for all copies
                      </Text>
                    </TouchableOpacity>
                  )}

                  {academicRows(item.id).map((row, idx) => {
                    if (sameForAll[item.id] && idx > 0) return null;
                    return (
                      <View key={idx} style={styles.copyBlock}>
                        {(quantities[item.id] || 1) > 1 &&
                          !sameForAll[item.id] && (
                            <Text style={styles.copyLabel}>Copy {idx + 1}</Text>
                          )}

                        <Text style={styles.fieldLabel}>Period</Text>
                        <SelectDropdown
                          value={row.period}
                          options={periodOptions}
                          placeholder="Select period"
                          onChange={(v) =>
                            setAcademicField(item.id, idx, 'period', v)
                          }
                        />

                        <Text style={styles.fieldLabel}>School year</Text>
                        <SelectDropdown
                          value={row.school_year}
                          options={schoolYearOptions}
                          placeholder="Select school year"
                          onChange={(v) =>
                            setAcademicField(item.id, idx, 'school_year', v)
                          }
                        />
                      </View>
                    );
                  })}
                </View></TourTarget>
              )}
            </View>
          );
        })
      )}

      <TourTarget id="priority"><PriorityStep
        priority={priority}
        setPriority={setPriority}
        priorityReason={priorityReason}
        setPriorityReason={setPriorityReason}
        priorityEnabled={priorityEnabled}
      /></TourTarget>

      <TouchableOpacity style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 16,
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryRow: {
    gap: 8,
    paddingRight: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  emptyBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  selected: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardTextCol: {
    flex: 1,
  },
  cardText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaChip: {
    fontSize: 11,
    color: COLORS.gray,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  amountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cashierChip: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  qtyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    backgroundColor: '#ddd',
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 19,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: 'center',
  },
  inlineBlock: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inlineHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  choicePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  pillActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  pillTextActive: {
    color: COLORS.primary,
  },
  sameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  smallCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sameText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
  },
  copyBlock: {
    marginTop: 6,
  },
  copyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  backButton: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ddd',
  },
  backButtonText: {
    color: COLORS.gray,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
});
