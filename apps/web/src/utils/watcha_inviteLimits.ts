/*
Copyright 2026 Watcha

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Plafond du nombre d'invitations d'un même envoi. Garde-fou contre le collage
 * d'une colonne entière de tableur, et alignement sur le `burst_count` de
 * `rc_third_party_invite` côté serveur : au-delà, les invitations ne partent
 * plus d'un bloc mais s'étalent au rythme du limiteur.
 *
 * Isolé dans son propre module parce que les deux dialogues d'invitation s'en
 * servent : le placer dans l'un d'eux créerait un cycle d'imports, le dialogue
 * de collage dépendant déjà des types du dialogue principal.
 */
export const MAX_INVITATIONS_PER_BATCH = 50;
