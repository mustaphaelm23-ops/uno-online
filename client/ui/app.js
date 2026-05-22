  /* ═══════════════════════════════════════════
    I18N — multi-language support
    ═══════════════════════════════════════════ */
  const I18N = {
    langs: [
      { code:'en', name:'English',   flag:'🇬🇧' },
      { code:'fr', name:'Français',  flag:'🇫🇷' },
      { code:'ar', name:'العربية',   flag:'🇸🇦' },
      { code:'de', name:'Deutsch',   flag:'🇩🇪' },
      { code:'es', name:'Español',   flag:'🇪🇸' },
      { code:'it', name:'Italiano',  flag:'🇮🇹' },
      { code:'sv', name:'Svenska',   flag:'🇸🇪' },
    ],
    current: localStorage.getItem('uno_lang') || 'en',
    dict: {
      en:{
        login:'Login', register:'Register', username:'Username', password:'Password',
        loginBtn:'Login →', createAcct:'Create Account →', onlineMP:'Online Multiplayer',
        play:'Play', createRoom:'Create Room', joinCode:'Join by Code', quickMatch:'Quick Match',
        gameCenter:'Game Center', dailyReward:'Daily Reward', ranked:'Ranked', tournament:'Tournament',
        followInsta:'Follow + 1000🪙', competitions:'Competitions', league:'League',
        championsLeague:'Champions League', continentalCups:'Continental Cups', soon:'SOON',
        account:'Account', myProfile:'My Profile', leaderboard:'Leaderboard', coins:'Coins',
        publicRooms:'🃏 Public Rooms', liveGames:'📺 Live Games',
        settings:'Settings', profile:'Profile', installApp:'Install App', adminPanel:'Admin Panel',
        logout:'Logout', language:'Language', gameMenu:'Game Menu', sound:'Sound', chat:'Chat',
        leaveGame:'Leave game', close:'Close', gameRoom:'Game Room', players:'Players',
        shareCode:'Room Code — Share with friends', copyCode:'Copy Code', startGame:'Start Game!',
        waitingPlayers:'Waiting for players...', waitingHost:'Waiting for host...',
        backToLobby:'Back to Lobby', cards:'cards', passTurn:'Pass turn', youWin:'YOU WIN!',
        findingMatch:'Finding Match...', cancel:'Cancel', inQueue:'in queue', pickColor:'PICK COLOR',
        chooseLanguage:'Choose Language',
        a_eyebrow:'ROOM CREATION', a_title:'FORGE YOUR ARENA',
        a_sub:'Choose your battlefield. Winner takes everything.', a_vault:'in vault',
        a_fighters:'Fighters', a_fightersSub:'How many players in the arena?',
        a_duel:'Duel', a_triple:'Triple', a_squad:'Squad',
        a_stake:'The Stake', a_stakeSub:'Every player matches. Winner takes the pot.',
        a_rCommon:'Common', a_rRare:'Rare', a_rEpic:'Epic', a_rLegendary:'Legendary', a_rMythic:'Mythic',
        a_access:'Access', a_accessSub:'Anyone can join, or invite only.',
        a_public:'Public', a_publicSub:'Show in lobby — anyone joins',
        a_private:'Private', a_privateSub:'Only with room code',
        a_squadTitle:'Your Squad', a_squadSub:'Invite friends — or leave empty for a random match.',
        a_loadingFriends:'Loading friends…',
        a_noFriends:'No friends yet — add some from the lobby 👥, or just play a random match.',
        a_friendsErr:'Couldn\'t load friends — you can still play a random match.',
        a_online:'Online', a_offline:'Offline',
        a_enterArena:'ENTER ARENA', a_notEnough:'NOT ENOUGH COINS',
        a_random:'Random', a_player:'player', a_players:'players',
        a_friendInvited:'friend invited', a_friendsInvited:'friends invited',
        g_everything:'Everything in one place', g_hHub:'GAME CENTER',
        g_trainingT:'Training Ground', g_trainingD:'Solo match vs an AI you choose — Easy, Medium or Hard.',
        g_scheduleT:'Match Schedule', g_scheduleD:'Exact date & time of every league fixture you have.',
        g_trophiesT:'Trophy Cabinet', g_trophiesD:'Every coin prize and reward you have ever won.',
        g_achT:'Achievements', g_achD:'Unlock milestone badges as you climb. How far can you go?',
        g_hTraining:'TRAINING GROUND', g_hTrainingS:'Practice against the AI',
        g_hSchedule:'MATCH SCHEDULE', g_hScheduleS:'Your upcoming league fixtures',
        g_hTrophies:'TROPHY CABINET', g_hTrophiesS:'Every prize you have won',
        g_hAch:'ACHIEVEMENTS', g_hAchS:'Milestones & badges',
        g_trainHint:'Pick your opponent. The match starts instantly — no coins on the line.',
        g_rookie:'Rookie', g_veteran:'Veteran', g_master:'Master',
        g_easy:'Easy', g_medium:'Medium', g_hard:'Hard',
        g_rookieD:'Plays random cards. Great for warming up.',
        g_veteranD:'Plays smart — saves attacks for the right moment.',
        g_masterD:'Ruthless. Punishes you the second you slip up.',
        g_enterTraining:'ENTER TRAINING', g_starting:'Starting…',
        g_loadFixtures:'Loading your fixtures…',
        g_noFixturesT:'No fixtures yet', g_noFixturesS:'Join the League to get your season schedule.',
        g_schedErr:'Could not load schedule', g_season:'Season', g_fixtures:'fixtures',
        g_nextUp:'NEXT UP', g_liveNow:'● LIVE NOW', g_soon:'soon',
        g_openCabinet:'Opening the cabinet…', g_emptyCabT:'Cabinet is empty… for now',
        g_emptyCabS:'Win matches, claim rewards and finish league seasons to fill it up.',
        g_trophyErr:'Could not load trophies', g_totalWon:'Total won across',
        g_reward:'reward', g_rewards:'rewards',
        g_unlocked:'UNLOCKED', g_badgesUnlocked:'Badges unlocked — keep playing to collect them all',
        g_tryLater:'Try again later', g_vs:'vs', g_bot:'BOT',
        ach_firstSteps:'First Steps', ach_firstStepsD:'Play your first game',
        ach_warm:'Getting Warm', ach_warmD:'Play 10 games',
        ach_seasoned:'Seasoned Player', ach_seasonedD:'Play 50 games',
        ach_firstWin:'First Victory', ach_firstWinD:'Win your first game',
        ach_habit:'Winning Habit', ach_habitD:'Win 10 games',
        ach_champion:'Champion', ach_championD:'Win 50 games',
        ach_collector:'Coin Collector', ach_collectorD:'Hold 10,000 coins',
        ach_roller:'High Roller', ach_rollerD:'Hold 100,000 coins',
        ach_victor:'Tournament Victor', ach_victorD:'Win a tournament',
        ach_skilled:'Skilled', ach_skilledD:'Reach 1300 ELO',
        ach_elite:'Elite', ach_eliteD:'Reach 1600 ELO',
        forgotPw:'Forgot password?', email:'Email', optional:'optional',
        emailHint:'Add an email and you can recover your account if you forget your password.',
        or:'or', playAsGuest:'Play as Guest', resetPw:'Reset Password',
        resetHint:'Enter your username and the email you registered with to set a new password.',
        newPassword:'New Password', backToLogin:'← Back to login',
        fillAll:'Fill all fields', pwResetOk:'Password reset — you can now log in',
        welcomeBack:'Welcome back', statRating:'Rating', statWins:'Wins', statWinRate:'Win Rate',
        chooseAvatar:'Choose Your Avatar', chooseAvatarSub:'Pick a character — tap to apply it instantly', avatarUpdated:'Avatar updated!',
      },
      fr:{
        login:'Connexion', register:'Inscription', username:'Nom d\'utilisateur', password:'Mot de passe',
        loginBtn:'Connexion →', createAcct:'Créer un compte →', onlineMP:'Multijoueur en ligne',
        play:'Jouer', createRoom:'Créer un salon', joinCode:'Rejoindre par code', quickMatch:'Partie rapide',
        gameCenter:'Centre de jeu', dailyReward:'Récompense quotidienne', ranked:'Classé', tournament:'Tournoi',
        followInsta:'Suivre + 1000🪙', competitions:'Compétitions', league:'Ligue',
        championsLeague:'Ligue des champions', continentalCups:'Coupes continentales', soon:'BIENTÔT',
        account:'Compte', myProfile:'Mon profil', leaderboard:'Classement', coins:'Pièces',
        publicRooms:'🃏 Salons publics', liveGames:'📺 Parties en direct',
        settings:'Paramètres', profile:'Profil', installApp:'Installer l\'app', adminPanel:'Panneau admin',
        logout:'Déconnexion', language:'Langue', gameMenu:'Menu du jeu', sound:'Son', chat:'Discussion',
        leaveGame:'Quitter la partie', close:'Fermer', gameRoom:'Salon de jeu', players:'Joueurs',
        shareCode:'Code du salon — Partagez avec vos amis', copyCode:'Copier le code', startGame:'Commencer !',
        waitingPlayers:'En attente de joueurs...', waitingHost:'En attente de l\'hôte...',
        backToLobby:'Retour au lobby', cards:'cartes', passTurn:'Passer son tour', youWin:'VOUS GAGNEZ !',
        findingMatch:'Recherche de partie...', cancel:'Annuler', inQueue:'en file', pickColor:'CHOISIR LA COULEUR',
        chooseLanguage:'Choisir la langue',
        a_eyebrow:'CRÉATION DE SALON', a_title:'FORGEZ VOTRE ARÈNE',
        a_sub:'Choisissez votre champ de bataille. Le gagnant rafle tout.', a_vault:'en réserve',
        a_fighters:'Combattants', a_fightersSub:'Combien de joueurs dans l\'arène ?',
        a_duel:'Duel', a_triple:'Triple', a_squad:'Équipe',
        a_stake:'La Mise', a_stakeSub:'Chaque joueur mise. Le gagnant rafle la cagnotte.',
        a_rCommon:'Commun', a_rRare:'Rare', a_rEpic:'Épique', a_rLegendary:'Légendaire', a_rMythic:'Mythique',
        a_access:'Accès', a_accessSub:'Ouvert à tous, ou sur invitation.',
        a_public:'Public', a_publicSub:'Visible dans le lobby — tout le monde rejoint',
        a_private:'Privé', a_privateSub:'Uniquement avec le code',
        a_squadTitle:'Votre Équipe', a_squadSub:'Invitez des amis — ou laissez vide pour une partie aléatoire.',
        a_loadingFriends:'Chargement des amis…',
        a_noFriends:'Aucun ami — ajoutez-en depuis le lobby 👥, ou jouez une partie aléatoire.',
        a_friendsErr:'Impossible de charger les amis — vous pouvez jouer une partie aléatoire.',
        a_online:'En ligne', a_offline:'Hors ligne',
        a_enterArena:'ENTRER DANS L\'ARÈNE', a_notEnough:'PAS ASSEZ DE PIÈCES',
        a_random:'Aléatoire', a_player:'joueur', a_players:'joueurs',
        a_friendInvited:'ami invité', a_friendsInvited:'amis invités',
        g_everything:'Tout au même endroit', g_hHub:'CENTRE DE JEU',
        g_trainingT:'Terrain d\'entraînement', g_trainingD:'Partie solo contre une IA au choix — Facile, Moyen ou Difficile.',
        g_scheduleT:'Calendrier des matchs', g_scheduleD:'Date et heure exactes de chaque match de ligue.',
        g_trophiesT:'Vitrine à trophées', g_trophiesD:'Tous les prix et récompenses que vous avez gagnés.',
        g_achT:'Succès', g_achD:'Débloquez des badges au fil de votre progression. Jusqu\'où irez-vous ?',
        g_hTraining:'TERRAIN D\'ENTRAÎNEMENT', g_hTrainingS:'Entraînez-vous contre l\'IA',
        g_hSchedule:'CALENDRIER DES MATCHS', g_hScheduleS:'Vos prochains matchs de ligue',
        g_hTrophies:'VITRINE À TROPHÉES', g_hTrophiesS:'Tous les prix gagnés',
        g_hAch:'SUCCÈS', g_hAchS:'Étapes et badges',
        g_trainHint:'Choisissez votre adversaire. La partie démarre aussitôt — aucune pièce en jeu.',
        g_rookie:'Débutant', g_veteran:'Vétéran', g_master:'Maître',
        g_easy:'Facile', g_medium:'Moyen', g_hard:'Difficile',
        g_rookieD:'Joue des cartes au hasard. Parfait pour s\'échauffer.',
        g_veteranD:'Joue malin — garde ses attaques pour le bon moment.',
        g_masterD:'Impitoyable. Vous punit à la moindre erreur.',
        g_enterTraining:'COMMENCER L\'ENTRAÎNEMENT', g_starting:'Démarrage…',
        g_loadFixtures:'Chargement de vos matchs…',
        g_noFixturesT:'Aucun match pour l\'instant', g_noFixturesS:'Rejoignez la Ligue pour obtenir votre calendrier.',
        g_schedErr:'Impossible de charger le calendrier', g_season:'Saison', g_fixtures:'matchs',
        g_nextUp:'À VENIR', g_liveNow:'● EN DIRECT', g_soon:'bientôt',
        g_openCabinet:'Ouverture de la vitrine…', g_emptyCabT:'Vitrine vide… pour l\'instant',
        g_emptyCabS:'Gagnez des matchs, récupérez des récompenses et terminez des saisons pour la remplir.',
        g_trophyErr:'Impossible de charger les trophées', g_totalWon:'Total gagné sur',
        g_reward:'récompense', g_rewards:'récompenses',
        g_unlocked:'DÉBLOQUÉ', g_badgesUnlocked:'Badges débloqués — continuez à jouer pour tous les obtenir',
        g_tryLater:'Réessayez plus tard', g_vs:'contre', g_bot:'BOT',
        ach_firstSteps:'Premiers pas', ach_firstStepsD:'Jouez votre première partie',
        ach_warm:'Échauffement', ach_warmD:'Jouez 10 parties',
        ach_seasoned:'Joueur aguerri', ach_seasonedD:'Jouez 50 parties',
        ach_firstWin:'Première victoire', ach_firstWinD:'Gagnez votre première partie',
        ach_habit:'Habitude gagnante', ach_habitD:'Gagnez 10 parties',
        ach_champion:'Champion', ach_championD:'Gagnez 50 parties',
        ach_collector:'Collectionneur de pièces', ach_collectorD:'Possédez 10 000 pièces',
        ach_roller:'Gros joueur', ach_rollerD:'Possédez 100 000 pièces',
        ach_victor:'Vainqueur de tournoi', ach_victorD:'Gagnez un tournoi',
        ach_skilled:'Talentueux', ach_skilledD:'Atteignez 1300 ELO',
        ach_elite:'Élite', ach_eliteD:'Atteignez 1600 ELO',
        forgotPw:'Mot de passe oublié ?', email:'E-mail', optional:'facultatif',
        emailHint:'Ajoutez un e-mail pour pouvoir récupérer votre compte si vous oubliez votre mot de passe.',
        or:'ou', playAsGuest:'Jouer en invité', resetPw:'Réinitialiser le mot de passe',
        resetHint:'Saisissez votre nom d\'utilisateur et l\'e-mail utilisé à l\'inscription pour définir un nouveau mot de passe.',
        newPassword:'Nouveau mot de passe', backToLogin:'← Retour à la connexion',
        fillAll:'Remplissez tous les champs', pwResetOk:'Mot de passe réinitialisé — vous pouvez vous connecter',
        welcomeBack:'Bon retour', statRating:'Classement', statWins:'Victoires', statWinRate:'Taux de victoire',
        chooseAvatar:'Choisissez votre avatar', chooseAvatarSub:'Choisissez un personnage — touchez pour l\'appliquer', avatarUpdated:'Avatar mis à jour !',
      },
      ar:{
        login:'تسجيل الدخول', register:'إنشاء حساب', username:'اسم المستخدم', password:'كلمة المرور',
        loginBtn:'دخول →', createAcct:'إنشاء حساب →', onlineMP:'لعب جماعي عبر الإنترنت',
        play:'العب', createRoom:'إنشاء غرفة', joinCode:'انضمام برمز', quickMatch:'مباراة سريعة',
        gameCenter:'مركز اللعب', dailyReward:'مكافأة يومية', ranked:'تصنيفي', tournament:'بطولة',
        followInsta:'تابع + 1000🪙', competitions:'المسابقات', league:'الدوري',
        championsLeague:'دوري الأبطال', continentalCups:'الكؤوس القارية', soon:'قريباً',
        account:'الحساب', myProfile:'ملفي الشخصي', leaderboard:'لوحة الصدارة', coins:'العملات',
        publicRooms:'🃏 الغرف العامة', liveGames:'📺 مباريات مباشرة',
        settings:'الإعدادات', profile:'الملف الشخصي', installApp:'تثبيت التطبيق', adminPanel:'لوحة الإدارة',
        logout:'تسجيل الخروج', language:'اللغة', gameMenu:'قائمة اللعبة', sound:'الصوت', chat:'الدردشة',
        leaveGame:'مغادرة المباراة', close:'إغلاق', gameRoom:'غرفة اللعب', players:'اللاعبون',
        shareCode:'رمز الغرفة — شاركه مع أصدقائك', copyCode:'نسخ الرمز', startGame:'ابدأ اللعبة!',
        waitingPlayers:'في انتظار اللاعبين...', waitingHost:'في انتظار المضيف...',
        backToLobby:'العودة للردهة', cards:'بطاقات', passTurn:'تمرير الدور', youWin:'لقد فزت!',
        findingMatch:'البحث عن مباراة...', cancel:'إلغاء', inQueue:'في الطابور', pickColor:'اختر اللون',
        chooseLanguage:'اختر اللغة',
        a_eyebrow:'إنشاء غرفة', a_title:'اصنع حلبتك',
        a_sub:'اختر ساحة معركتك. الفائز يأخذ كل شيء.', a_vault:'في الخزنة',
        a_fighters:'المقاتلون', a_fightersSub:'كم عدد اللاعبين في الحلبة؟',
        a_duel:'مبارزة', a_triple:'ثلاثي', a_squad:'فريق',
        a_stake:'الرهان', a_stakeSub:'كل لاعب يراهن. الفائز يأخذ كل النقاط.',
        a_rCommon:'عادي', a_rRare:'نادر', a_rEpic:'ملحمي', a_rLegendary:'أسطوري', a_rMythic:'خرافي',
        a_access:'الدخول', a_accessSub:'مفتوح للجميع، أو بدعوة فقط.',
        a_public:'عام', a_publicSub:'يظهر في الردهة — أي شخص ينضم',
        a_private:'خاص', a_privateSub:'فقط برمز الغرفة',
        a_squadTitle:'فريقك', a_squadSub:'ادعُ أصدقاءك — أو اتركها فارغة لمباراة عشوائية.',
        a_loadingFriends:'جارٍ تحميل الأصدقاء…',
        a_noFriends:'لا أصدقاء بعد — أضف بعضهم من الردهة 👥، أو العب مباراة عشوائية.',
        a_friendsErr:'تعذّر تحميل الأصدقاء — لا يزال بإمكانك لعب مباراة عشوائية.',
        a_online:'متصل', a_offline:'غير متصل',
        a_enterArena:'ادخل الحلبة', a_notEnough:'لا توجد عملات كافية',
        a_random:'عشوائي', a_player:'لاعب', a_players:'لاعبين',
        a_friendInvited:'صديق مدعو', a_friendsInvited:'أصدقاء مدعوون',
        g_everything:'كل شيء في مكان واحد', g_hHub:'مركز اللعب',
        g_trainingT:'ساحة التدريب', g_trainingD:'مباراة فردية ضد ذكاء اصطناعي تختاره — سهل أو متوسط أو صعب.',
        g_scheduleT:'جدول المباريات', g_scheduleD:'التاريخ والوقت الدقيق لكل مباراة دوري لديك.',
        g_trophiesT:'خزانة الجوائز', g_trophiesD:'كل جائزة ومكافأة فزت بها على الإطلاق.',
        g_achT:'الإنجازات', g_achD:'افتح شارات الإنجاز كلما تقدمت. إلى أي مدى يمكنك الوصول؟',
        g_hTraining:'ساحة التدريب', g_hTrainingS:'تدرّب ضد الذكاء الاصطناعي',
        g_hSchedule:'جدول المباريات', g_hScheduleS:'مبارياتك القادمة في الدوري',
        g_hTrophies:'خزانة الجوائز', g_hTrophiesS:'كل جائزة فزت بها',
        g_hAch:'الإنجازات', g_hAchS:'المراحل والشارات',
        g_trainHint:'اختر خصمك. تبدأ المباراة فوراً — بدون عملات على المحك.',
        g_rookie:'مبتدئ', g_veteran:'محترف', g_master:'خبير',
        g_easy:'سهل', g_medium:'متوسط', g_hard:'صعب',
        g_rookieD:'يلعب بطاقات عشوائية. مثالي للإحماء.',
        g_veteranD:'يلعب بذكاء — يحتفظ بالهجمات للحظة المناسبة.',
        g_masterD:'لا يرحم. يعاقبك لحظة أن تخطئ.',
        g_enterTraining:'ابدأ التدريب', g_starting:'جارٍ البدء…',
        g_loadFixtures:'جارٍ تحميل مبارياتك…',
        g_noFixturesT:'لا مباريات بعد', g_noFixturesS:'انضم إلى الدوري للحصول على جدول الموسم.',
        g_schedErr:'تعذّر تحميل الجدول', g_season:'الموسم', g_fixtures:'مباريات',
        g_nextUp:'التالية', g_liveNow:'● مباشر الآن', g_soon:'قريباً',
        g_openCabinet:'جارٍ فتح الخزانة…', g_emptyCabT:'الخزانة فارغة… حالياً',
        g_emptyCabS:'افز بالمباريات واحصل على المكافآت وأنهِ مواسم الدوري لتملأها.',
        g_trophyErr:'تعذّر تحميل الجوائز', g_totalWon:'إجمالي الفوز عبر',
        g_reward:'مكافأة', g_rewards:'مكافآت',
        g_unlocked:'مفتوح', g_badgesUnlocked:'شارات مفتوحة — واصل اللعب لتجمعها كلها',
        g_tryLater:'حاول مرة أخرى لاحقاً', g_vs:'ضد', g_bot:'بوت',
        ach_firstSteps:'الخطوات الأولى', ach_firstStepsD:'العب أول مباراة لك',
        ach_warm:'الإحماء', ach_warmD:'العب 10 مباريات',
        ach_seasoned:'لاعب متمرّس', ach_seasonedD:'العب 50 مباراة',
        ach_firstWin:'أول انتصار', ach_firstWinD:'افز بأول مباراة لك',
        ach_habit:'عادة الفوز', ach_habitD:'افز بـ 10 مباريات',
        ach_champion:'بطل', ach_championD:'افز بـ 50 مباراة',
        ach_collector:'جامع العملات', ach_collectorD:'احتفظ بـ 10٬000 عملة',
        ach_roller:'مراهن كبير', ach_rollerD:'احتفظ بـ 100٬000 عملة',
        ach_victor:'بطل البطولة', ach_victorD:'افز ببطولة',
        ach_skilled:'ماهر', ach_skilledD:'اوصل إلى 1300 نقطة تصنيف',
        ach_elite:'النخبة', ach_eliteD:'اوصل إلى 1600 نقطة تصنيف',
        forgotPw:'نسيت كلمة المرور؟', email:'البريد الإلكتروني', optional:'اختياري',
        emailHint:'أضف بريداً إلكترونياً لتتمكن من استعادة حسابك إذا نسيت كلمة المرور.',
        or:'أو', playAsGuest:'العب كضيف', resetPw:'إعادة تعيين كلمة المرور',
        resetHint:'أدخل اسم المستخدم والبريد الإلكتروني الذي سجّلت به لتعيين كلمة مرور جديدة.',
        newPassword:'كلمة مرور جديدة', backToLogin:'← العودة لتسجيل الدخول',
        fillAll:'املأ جميع الحقول', pwResetOk:'تمت إعادة تعيين كلمة المرور — يمكنك الآن تسجيل الدخول',
        welcomeBack:'مرحباً بعودتك', statRating:'التصنيف', statWins:'انتصارات', statWinRate:'نسبة الفوز',
        chooseAvatar:'اختر صورتك الرمزية', chooseAvatarSub:'اختر شخصية — اضغط لتطبيقها فوراً', avatarUpdated:'تم تحديث الصورة الرمزية!',
      },
      de:{
        login:'Anmelden', register:'Registrieren', username:'Benutzername', password:'Passwort',
        loginBtn:'Anmelden →', createAcct:'Konto erstellen →', onlineMP:'Online-Mehrspieler',
        play:'Spielen', createRoom:'Raum erstellen', joinCode:'Mit Code beitreten', quickMatch:'Schnelles Spiel',
        gameCenter:'Spielzentrum', dailyReward:'Tägliche Belohnung', ranked:'Rangliste', tournament:'Turnier',
        followInsta:'Folgen + 1000🪙', competitions:'Wettbewerbe', league:'Liga',
        championsLeague:'Champions League', continentalCups:'Kontinentalpokale', soon:'BALD',
        account:'Konto', myProfile:'Mein Profil', leaderboard:'Bestenliste', coins:'Münzen',
        publicRooms:'🃏 Öffentliche Räume', liveGames:'📺 Live-Spiele',
        settings:'Einstellungen', profile:'Profil', installApp:'App installieren', adminPanel:'Admin-Panel',
        logout:'Abmelden', language:'Sprache', gameMenu:'Spielmenü', sound:'Ton', chat:'Chat',
        leaveGame:'Spiel verlassen', close:'Schließen', gameRoom:'Spielraum', players:'Spieler',
        shareCode:'Raumcode — Mit Freunden teilen', copyCode:'Code kopieren', startGame:'Spiel starten!',
        waitingPlayers:'Warte auf Spieler...', waitingHost:'Warte auf Host...',
        backToLobby:'Zurück zur Lobby', cards:'Karten', passTurn:'Zug aussetzen', youWin:'DU GEWINNST!',
        findingMatch:'Suche Spiel...', cancel:'Abbrechen', inQueue:'in Warteschlange', pickColor:'FARBE WÄHLEN',
        chooseLanguage:'Sprache wählen',
        a_eyebrow:'RAUM ERSTELLEN', a_title:'SCHMIEDE DEINE ARENA',
        a_sub:'Wähle dein Schlachtfeld. Der Sieger bekommt alles.', a_vault:'im Tresor',
        a_fighters:'Kämpfer', a_fightersSub:'Wie viele Spieler in der Arena?',
        a_duel:'Duell', a_triple:'Trio', a_squad:'Team',
        a_stake:'Der Einsatz', a_stakeSub:'Jeder Spieler setzt. Der Sieger bekommt den Pott.',
        a_rCommon:'Gewöhnlich', a_rRare:'Selten', a_rEpic:'Episch', a_rLegendary:'Legendär', a_rMythic:'Mythisch',
        a_access:'Zugang', a_accessSub:'Offen für alle oder nur mit Einladung.',
        a_public:'Öffentlich', a_publicSub:'In der Lobby sichtbar — jeder tritt bei',
        a_private:'Privat', a_privateSub:'Nur mit Raumcode',
        a_squadTitle:'Dein Team', a_squadSub:'Lade Freunde ein — oder lass es leer für ein Zufallsspiel.',
        a_loadingFriends:'Freunde werden geladen…',
        a_noFriends:'Noch keine Freunde — füge welche in der Lobby hinzu 👥, oder spiel ein Zufallsspiel.',
        a_friendsErr:'Freunde konnten nicht geladen werden — du kannst trotzdem zufällig spielen.',
        a_online:'Online', a_offline:'Offline',
        a_enterArena:'ARENA BETRETEN', a_notEnough:'NICHT GENUG MÜNZEN',
        a_random:'Zufällig', a_player:'Spieler', a_players:'Spieler',
        a_friendInvited:'Freund eingeladen', a_friendsInvited:'Freunde eingeladen',
        g_everything:'Alles an einem Ort', g_hHub:'SPIELZENTRUM',
        g_trainingT:'Trainingsplatz', g_trainingD:'Solo-Spiel gegen eine KI deiner Wahl — Leicht, Mittel oder Schwer.',
        g_scheduleT:'Spielplan', g_scheduleD:'Genaues Datum und Uhrzeit jedes Liga-Spiels.',
        g_trophiesT:'Trophäenschrank', g_trophiesD:'Jeder Preis und jede Belohnung, die du je gewonnen hast.',
        g_achT:'Erfolge', g_achD:'Schalte Meilenstein-Abzeichen frei. Wie weit kommst du?',
        g_hTraining:'TRAININGSPLATZ', g_hTrainingS:'Übe gegen die KI',
        g_hSchedule:'SPIELPLAN', g_hScheduleS:'Deine kommenden Liga-Spiele',
        g_hTrophies:'TROPHÄENSCHRANK', g_hTrophiesS:'Jeder gewonnene Preis',
        g_hAch:'ERFOLGE', g_hAchS:'Meilensteine & Abzeichen',
        g_trainHint:'Wähle deinen Gegner. Das Spiel startet sofort — keine Münzen im Spiel.',
        g_rookie:'Anfänger', g_veteran:'Veteran', g_master:'Meister',
        g_easy:'Leicht', g_medium:'Mittel', g_hard:'Schwer',
        g_rookieD:'Spielt zufällige Karten. Perfekt zum Aufwärmen.',
        g_veteranD:'Spielt clever — spart Angriffe für den richtigen Moment.',
        g_masterD:'Gnadenlos. Bestraft dich beim kleinsten Fehler.',
        g_enterTraining:'TRAINING STARTEN', g_starting:'Wird gestartet…',
        g_loadFixtures:'Deine Spiele werden geladen…',
        g_noFixturesT:'Noch keine Spiele', g_noFixturesS:'Tritt der Liga bei, um deinen Saisonplan zu erhalten.',
        g_schedErr:'Spielplan konnte nicht geladen werden', g_season:'Saison', g_fixtures:'Spiele',
        g_nextUp:'ALS NÄCHSTES', g_liveNow:'● JETZT LIVE', g_soon:'bald',
        g_openCabinet:'Schrank wird geöffnet…', g_emptyCabT:'Schrank ist leer… noch',
        g_emptyCabS:'Gewinne Spiele, hole Belohnungen ab und beende Liga-Saisons, um ihn zu füllen.',
        g_trophyErr:'Trophäen konnten nicht geladen werden', g_totalWon:'Gesamt gewonnen über',
        g_reward:'Belohnung', g_rewards:'Belohnungen',
        g_unlocked:'FREIGESCHALTET', g_badgesUnlocked:'Abzeichen freigeschaltet — spiel weiter, um alle zu sammeln',
        g_tryLater:'Versuch es später erneut', g_vs:'gegen', g_bot:'BOT',
        ach_firstSteps:'Erste Schritte', ach_firstStepsD:'Spiele dein erstes Spiel',
        ach_warm:'Aufgewärmt', ach_warmD:'Spiele 10 Spiele',
        ach_seasoned:'Erfahrener Spieler', ach_seasonedD:'Spiele 50 Spiele',
        ach_firstWin:'Erster Sieg', ach_firstWinD:'Gewinne dein erstes Spiel',
        ach_habit:'Sieggewohnheit', ach_habitD:'Gewinne 10 Spiele',
        ach_champion:'Champion', ach_championD:'Gewinne 50 Spiele',
        ach_collector:'Münzensammler', ach_collectorD:'Besitze 10.000 Münzen',
        ach_roller:'Großspieler', ach_rollerD:'Besitze 100.000 Münzen',
        ach_victor:'Turniersieger', ach_victorD:'Gewinne ein Turnier',
        ach_skilled:'Geschickt', ach_skilledD:'Erreiche 1300 ELO',
        ach_elite:'Elite', ach_eliteD:'Erreiche 1600 ELO',
        forgotPw:'Passwort vergessen?', email:'E-Mail', optional:'optional',
        emailHint:'Füge eine E-Mail hinzu, um dein Konto wiederherstellen zu können, falls du dein Passwort vergisst.',
        or:'oder', playAsGuest:'Als Gast spielen', resetPw:'Passwort zurücksetzen',
        resetHint:'Gib deinen Benutzernamen und die bei der Registrierung verwendete E-Mail ein, um ein neues Passwort festzulegen.',
        newPassword:'Neues Passwort', backToLogin:'← Zurück zur Anmeldung',
        fillAll:'Fülle alle Felder aus', pwResetOk:'Passwort zurückgesetzt — du kannst dich jetzt anmelden',
        welcomeBack:'Willkommen zurück', statRating:'Wertung', statWins:'Siege', statWinRate:'Siegquote',
        chooseAvatar:'Wähle deinen Avatar', chooseAvatarSub:'Wähle einen Charakter — zum Anwenden tippen', avatarUpdated:'Avatar aktualisiert!',
      },
      es:{
        login:'Iniciar sesión', register:'Registrarse', username:'Usuario', password:'Contraseña',
        loginBtn:'Entrar →', createAcct:'Crear cuenta →', onlineMP:'Multijugador en línea',
        play:'Jugar', createRoom:'Crear sala', joinCode:'Unirse por código', quickMatch:'Partida rápida',
        gameCenter:'Centro de juego', dailyReward:'Recompensa diaria', ranked:'Clasificatoria', tournament:'Torneo',
        followInsta:'Seguir + 1000🪙', competitions:'Competiciones', league:'Liga',
        championsLeague:'Liga de Campeones', continentalCups:'Copas continentales', soon:'PRONTO',
        account:'Cuenta', myProfile:'Mi perfil', leaderboard:'Clasificación', coins:'Monedas',
        publicRooms:'🃏 Salas públicas', liveGames:'📺 Partidas en vivo',
        settings:'Ajustes', profile:'Perfil', installApp:'Instalar app', adminPanel:'Panel admin',
        logout:'Cerrar sesión', language:'Idioma', gameMenu:'Menú del juego', sound:'Sonido', chat:'Chat',
        leaveGame:'Salir de la partida', close:'Cerrar', gameRoom:'Sala de juego', players:'Jugadores',
        shareCode:'Código de sala — Comparte con amigos', copyCode:'Copiar código', startGame:'¡Empezar!',
        waitingPlayers:'Esperando jugadores...', waitingHost:'Esperando al anfitrión...',
        backToLobby:'Volver al lobby', cards:'cartas', passTurn:'Pasar turno', youWin:'¡GANASTE!',
        findingMatch:'Buscando partida...', cancel:'Cancelar', inQueue:'en cola', pickColor:'ELIGE COLOR',
        chooseLanguage:'Elegir idioma',
        a_eyebrow:'CREACIÓN DE SALA', a_title:'FORJA TU ARENA',
        a_sub:'Elige tu campo de batalla. El ganador se lo lleva todo.', a_vault:'en la bóveda',
        a_fighters:'Luchadores', a_fightersSub:'¿Cuántos jugadores en la arena?',
        a_duel:'Duelo', a_triple:'Triple', a_squad:'Escuadra',
        a_stake:'La Apuesta', a_stakeSub:'Cada jugador apuesta. El ganador se lleva el bote.',
        a_rCommon:'Común', a_rRare:'Raro', a_rEpic:'Épico', a_rLegendary:'Legendario', a_rMythic:'Mítico',
        a_access:'Acceso', a_accessSub:'Abierto a todos, o solo con invitación.',
        a_public:'Pública', a_publicSub:'Visible en el lobby — cualquiera se une',
        a_private:'Privada', a_privateSub:'Solo con código de sala',
        a_squadTitle:'Tu Escuadra', a_squadSub:'Invita amigos — o déjalo vacío para una partida aleatoria.',
        a_loadingFriends:'Cargando amigos…',
        a_noFriends:'Aún no tienes amigos — añade algunos desde el lobby 👥, o juega una partida aleatoria.',
        a_friendsErr:'No se pudieron cargar los amigos — aún puedes jugar una partida aleatoria.',
        a_online:'En línea', a_offline:'Desconectado',
        a_enterArena:'ENTRAR A LA ARENA', a_notEnough:'MONEDAS INSUFICIENTES',
        a_random:'Aleatorio', a_player:'jugador', a_players:'jugadores',
        a_friendInvited:'amigo invitado', a_friendsInvited:'amigos invitados',
        g_everything:'Todo en un solo lugar', g_hHub:'CENTRO DE JUEGO',
        g_trainingT:'Campo de entrenamiento', g_trainingD:'Partida en solitario contra una IA a tu elección — Fácil, Medio o Difícil.',
        g_scheduleT:'Calendario de partidas', g_scheduleD:'Fecha y hora exactas de cada partido de liga.',
        g_trophiesT:'Vitrina de trofeos', g_trophiesD:'Todos los premios y recompensas que has ganado.',
        g_achT:'Logros', g_achD:'Desbloquea insignias a medida que avanzas. ¿Hasta dónde llegarás?',
        g_hTraining:'CAMPO DE ENTRENAMIENTO', g_hTrainingS:'Practica contra la IA',
        g_hSchedule:'CALENDARIO DE PARTIDAS', g_hScheduleS:'Tus próximos partidos de liga',
        g_hTrophies:'VITRINA DE TROFEOS', g_hTrophiesS:'Todos los premios ganados',
        g_hAch:'LOGROS', g_hAchS:'Hitos e insignias',
        g_trainHint:'Elige tu rival. La partida empieza al instante — sin monedas en juego.',
        g_rookie:'Novato', g_veteran:'Veterano', g_master:'Maestro',
        g_easy:'Fácil', g_medium:'Medio', g_hard:'Difícil',
        g_rookieD:'Juega cartas al azar. Genial para calentar.',
        g_veteranD:'Juega con astucia — guarda los ataques para el momento justo.',
        g_masterD:'Despiadado. Te castiga en cuanto fallas.',
        g_enterTraining:'EMPEZAR ENTRENAMIENTO', g_starting:'Empezando…',
        g_loadFixtures:'Cargando tus partidas…',
        g_noFixturesT:'Aún no hay partidas', g_noFixturesS:'Únete a la Liga para obtener tu calendario.',
        g_schedErr:'No se pudo cargar el calendario', g_season:'Temporada', g_fixtures:'partidas',
        g_nextUp:'PRÓXIMA', g_liveNow:'● EN VIVO', g_soon:'pronto',
        g_openCabinet:'Abriendo la vitrina…', g_emptyCabT:'La vitrina está vacía… por ahora',
        g_emptyCabS:'Gana partidas, reclama recompensas y termina temporadas de liga para llenarla.',
        g_trophyErr:'No se pudieron cargar los trofeos', g_totalWon:'Total ganado en',
        g_reward:'recompensa', g_rewards:'recompensas',
        g_unlocked:'DESBLOQUEADO', g_badgesUnlocked:'Insignias desbloqueadas — sigue jugando para conseguirlas todas',
        g_tryLater:'Inténtalo más tarde', g_vs:'vs', g_bot:'BOT',
        ach_firstSteps:'Primeros pasos', ach_firstStepsD:'Juega tu primera partida',
        ach_warm:'Calentando', ach_warmD:'Juega 10 partidas',
        ach_seasoned:'Jugador curtido', ach_seasonedD:'Juega 50 partidas',
        ach_firstWin:'Primera victoria', ach_firstWinD:'Gana tu primera partida',
        ach_habit:'Hábito ganador', ach_habitD:'Gana 10 partidas',
        ach_champion:'Campeón', ach_championD:'Gana 50 partidas',
        ach_collector:'Coleccionista de monedas', ach_collectorD:'Ten 10.000 monedas',
        ach_roller:'Gran apostador', ach_rollerD:'Ten 100.000 monedas',
        ach_victor:'Vencedor de torneo', ach_victorD:'Gana un torneo',
        ach_skilled:'Hábil', ach_skilledD:'Alcanza 1300 ELO',
        ach_elite:'Élite', ach_eliteD:'Alcanza 1600 ELO',
        forgotPw:'¿Olvidaste tu contraseña?', email:'Correo', optional:'opcional',
        emailHint:'Añade un correo para poder recuperar tu cuenta si olvidas la contraseña.',
        or:'o', playAsGuest:'Jugar como invitado', resetPw:'Restablecer contraseña',
        resetHint:'Introduce tu usuario y el correo con el que te registraste para definir una nueva contraseña.',
        newPassword:'Nueva contraseña', backToLogin:'← Volver a iniciar sesión',
        fillAll:'Rellena todos los campos', pwResetOk:'Contraseña restablecida — ya puedes iniciar sesión',
        welcomeBack:'Bienvenido de nuevo', statRating:'Puntuación', statWins:'Victorias', statWinRate:'Tasa de victorias',
        chooseAvatar:'Elige tu avatar', chooseAvatarSub:'Elige un personaje — toca para aplicarlo', avatarUpdated:'¡Avatar actualizado!',
      },
      it:{
        login:'Accedi', register:'Registrati', username:'Nome utente', password:'Password',
        loginBtn:'Accedi →', createAcct:'Crea account →', onlineMP:'Multigiocatore online',
        play:'Gioca', createRoom:'Crea stanza', joinCode:'Unisciti con codice', quickMatch:'Partita rapida',
        gameCenter:'Centro giochi', dailyReward:'Ricompensa giornaliera', ranked:'Classificata', tournament:'Torneo',
        followInsta:'Segui + 1000🪙', competitions:'Competizioni', league:'Lega',
        championsLeague:'Champions League', continentalCups:'Coppe continentali', soon:'PRESTO',
        account:'Account', myProfile:'Il mio profilo', leaderboard:'Classifica', coins:'Monete',
        publicRooms:'🃏 Stanze pubbliche', liveGames:'📺 Partite dal vivo',
        settings:'Impostazioni', profile:'Profilo', installApp:'Installa app', adminPanel:'Pannello admin',
        logout:'Esci', language:'Lingua', gameMenu:'Menu di gioco', sound:'Audio', chat:'Chat',
        leaveGame:'Abbandona partita', close:'Chiudi', gameRoom:'Stanza di gioco', players:'Giocatori',
        shareCode:'Codice stanza — Condividi con gli amici', copyCode:'Copia codice', startGame:'Inizia!',
        waitingPlayers:'In attesa di giocatori...', waitingHost:'In attesa dell\'host...',
        backToLobby:'Torna alla lobby', cards:'carte', passTurn:'Passa il turno', youWin:'HAI VINTO!',
        findingMatch:'Ricerca partita...', cancel:'Annulla', inQueue:'in coda', pickColor:'SCEGLI COLORE',
        chooseLanguage:'Scegli la lingua',
        a_eyebrow:'CREAZIONE STANZA', a_title:'FORGIA LA TUA ARENA',
        a_sub:'Scegli il tuo campo di battaglia. Il vincitore prende tutto.', a_vault:'nel forziere',
        a_fighters:'Combattenti', a_fightersSub:'Quanti giocatori nell\'arena?',
        a_duel:'Duello', a_triple:'Triplo', a_squad:'Squadra',
        a_stake:'La Posta', a_stakeSub:'Ogni giocatore punta. Il vincitore prende il piatto.',
        a_rCommon:'Comune', a_rRare:'Raro', a_rEpic:'Epico', a_rLegendary:'Leggendario', a_rMythic:'Mitico',
        a_access:'Accesso', a_accessSub:'Aperto a tutti, o solo su invito.',
        a_public:'Pubblica', a_publicSub:'Visibile nella lobby — chiunque entra',
        a_private:'Privata', a_privateSub:'Solo con il codice stanza',
        a_squadTitle:'La Tua Squadra', a_squadSub:'Invita amici — o lascia vuoto per una partita casuale.',
        a_loadingFriends:'Caricamento amici…',
        a_noFriends:'Ancora nessun amico — aggiungine dalla lobby 👥, o gioca una partita casuale.',
        a_friendsErr:'Impossibile caricare gli amici — puoi comunque giocare una partita casuale.',
        a_online:'Online', a_offline:'Offline',
        a_enterArena:'ENTRA NELL\'ARENA', a_notEnough:'MONETE INSUFFICIENTI',
        a_random:'Casuale', a_player:'giocatore', a_players:'giocatori',
        a_friendInvited:'amico invitato', a_friendsInvited:'amici invitati',
        g_everything:'Tutto in un unico posto', g_hHub:'CENTRO GIOCHI',
        g_trainingT:'Campo di allenamento', g_trainingD:'Partita in solitaria contro un\'IA a tua scelta — Facile, Medio o Difficile.',
        g_scheduleT:'Calendario partite', g_scheduleD:'Data e ora esatte di ogni partita di lega.',
        g_trophiesT:'Bacheca dei trofei', g_trophiesD:'Ogni premio e ricompensa che hai mai vinto.',
        g_achT:'Obiettivi', g_achD:'Sblocca distintivi mentre avanzi. Fin dove arriverai?',
        g_hTraining:'CAMPO DI ALLENAMENTO', g_hTrainingS:'Allenati contro l\'IA',
        g_hSchedule:'CALENDARIO PARTITE', g_hScheduleS:'Le tue prossime partite di lega',
        g_hTrophies:'BACHECA DEI TROFEI', g_hTrophiesS:'Ogni premio vinto',
        g_hAch:'OBIETTIVI', g_hAchS:'Traguardi e distintivi',
        g_trainHint:'Scegli il tuo avversario. La partita inizia subito — nessuna moneta in gioco.',
        g_rookie:'Esordiente', g_veteran:'Veterano', g_master:'Maestro',
        g_easy:'Facile', g_medium:'Medio', g_hard:'Difficile',
        g_rookieD:'Gioca carte a caso. Perfetto per scaldarsi.',
        g_veteranD:'Gioca con astuzia — tiene gli attacchi per il momento giusto.',
        g_masterD:'Spietato. Ti punisce al minimo errore.',
        g_enterTraining:'INIZIA ALLENAMENTO', g_starting:'Avvio…',
        g_loadFixtures:'Caricamento delle tue partite…',
        g_noFixturesT:'Ancora nessuna partita', g_noFixturesS:'Unisciti alla Lega per ottenere il calendario.',
        g_schedErr:'Impossibile caricare il calendario', g_season:'Stagione', g_fixtures:'partite',
        g_nextUp:'PROSSIMA', g_liveNow:'● IN DIRETTA', g_soon:'presto',
        g_openCabinet:'Apertura della bacheca…', g_emptyCabT:'La bacheca è vuota… per ora',
        g_emptyCabS:'Vinci partite, riscuoti ricompense e completa stagioni di lega per riempirla.',
        g_trophyErr:'Impossibile caricare i trofei', g_totalWon:'Totale vinto su',
        g_reward:'ricompensa', g_rewards:'ricompense',
        g_unlocked:'SBLOCCATO', g_badgesUnlocked:'Distintivi sbloccati — continua a giocare per averli tutti',
        g_tryLater:'Riprova più tardi', g_vs:'contro', g_bot:'BOT',
        ach_firstSteps:'Primi passi', ach_firstStepsD:'Gioca la tua prima partita',
        ach_warm:'Riscaldamento', ach_warmD:'Gioca 10 partite',
        ach_seasoned:'Giocatore esperto', ach_seasonedD:'Gioca 50 partite',
        ach_firstWin:'Prima vittoria', ach_firstWinD:'Vinci la tua prima partita',
        ach_habit:'Abitudine vincente', ach_habitD:'Vinci 10 partite',
        ach_champion:'Campione', ach_championD:'Vinci 50 partite',
        ach_collector:'Collezionista di monete', ach_collectorD:'Possiedi 10.000 monete',
        ach_roller:'Grande scommettitore', ach_rollerD:'Possiedi 100.000 monete',
        ach_victor:'Vincitore di torneo', ach_victorD:'Vinci un torneo',
        ach_skilled:'Abile', ach_skilledD:'Raggiungi 1300 ELO',
        ach_elite:'Élite', ach_eliteD:'Raggiungi 1600 ELO',
        forgotPw:'Password dimenticata?', email:'E-mail', optional:'facoltativo',
        emailHint:'Aggiungi un\'e-mail per poter recuperare il tuo account se dimentichi la password.',
        or:'oppure', playAsGuest:'Gioca come ospite', resetPw:'Reimposta password',
        resetHint:'Inserisci il tuo nome utente e l\'e-mail usata in fase di registrazione per impostare una nuova password.',
        newPassword:'Nuova password', backToLogin:'← Torna al login',
        fillAll:'Compila tutti i campi', pwResetOk:'Password reimpostata — ora puoi accedere',
        welcomeBack:'Bentornato', statRating:'Punteggio', statWins:'Vittorie', statWinRate:'Tasso di vittorie',
        chooseAvatar:'Scegli il tuo avatar', chooseAvatarSub:'Scegli un personaggio — tocca per applicarlo', avatarUpdated:'Avatar aggiornato!',
      },
      sv:{
        login:'Logga in', register:'Registrera', username:'Användarnamn', password:'Lösenord',
        loginBtn:'Logga in →', createAcct:'Skapa konto →', onlineMP:'Onlinespel för flera',
        play:'Spela', createRoom:'Skapa rum', joinCode:'Gå med via kod', quickMatch:'Snabbmatch',
        gameCenter:'Spelcenter', dailyReward:'Daglig belöning', ranked:'Rankad', tournament:'Turnering',
        followInsta:'Följ + 1000🪙', competitions:'Tävlingar', league:'Liga',
        championsLeague:'Champions League', continentalCups:'Kontinentala cuper', soon:'SNART',
        account:'Konto', myProfile:'Min profil', leaderboard:'Topplista', coins:'Mynt',
        publicRooms:'🃏 Offentliga rum', liveGames:'📺 Livespel',
        settings:'Inställningar', profile:'Profil', installApp:'Installera app', adminPanel:'Adminpanel',
        logout:'Logga ut', language:'Språk', gameMenu:'Spelmeny', sound:'Ljud', chat:'Chatt',
        leaveGame:'Lämna spelet', close:'Stäng', gameRoom:'Spelrum', players:'Spelare',
        shareCode:'Rumskod — Dela med vänner', copyCode:'Kopiera kod', startGame:'Starta spelet!',
        waitingPlayers:'Väntar på spelare...', waitingHost:'Väntar på värd...',
        backToLobby:'Tillbaka till lobbyn', cards:'kort', passTurn:'Hoppa över tur', youWin:'DU VINNER!',
        findingMatch:'Söker match...', cancel:'Avbryt', inQueue:'i kö', pickColor:'VÄLJ FÄRG',
        chooseLanguage:'Välj språk',
        a_eyebrow:'SKAPA RUM', a_title:'SMID DIN ARENA',
        a_sub:'Välj ditt slagfält. Vinnaren tar allt.', a_vault:'i valvet',
        a_fighters:'Kämpar', a_fightersSub:'Hur många spelare i arenan?',
        a_duel:'Duell', a_triple:'Trippel', a_squad:'Lag',
        a_stake:'Insatsen', a_stakeSub:'Varje spelare satsar. Vinnaren tar potten.',
        a_rCommon:'Vanlig', a_rRare:'Sällsynt', a_rEpic:'Episk', a_rLegendary:'Legendarisk', a_rMythic:'Mytisk',
        a_access:'Åtkomst', a_accessSub:'Öppet för alla, eller endast med inbjudan.',
        a_public:'Offentligt', a_publicSub:'Syns i lobbyn — vem som helst går med',
        a_private:'Privat', a_privateSub:'Endast med rumskod',
        a_squadTitle:'Ditt Lag', a_squadSub:'Bjud in vänner — eller lämna tomt för en slumpmatch.',
        a_loadingFriends:'Laddar vänner…',
        a_noFriends:'Inga vänner än — lägg till några från lobbyn 👥, eller spela en slumpmatch.',
        a_friendsErr:'Kunde inte ladda vänner — du kan ändå spela en slumpmatch.',
        a_online:'Online', a_offline:'Offline',
        a_enterArena:'GÅ IN I ARENAN', a_notEnough:'INTE TILLRÄCKLIGT MED MYNT',
        a_random:'Slumpmässig', a_player:'spelare', a_players:'spelare',
        a_friendInvited:'vän inbjuden', a_friendsInvited:'vänner inbjudna',
        g_everything:'Allt på ett ställe', g_hHub:'SPELCENTER',
        g_trainingT:'Träningsplan', g_trainingD:'Solomatch mot en AI du väljer — Lätt, Medel eller Svår.',
        g_scheduleT:'Matchschema', g_scheduleD:'Exakt datum och tid för varje ligamatch du har.',
        g_trophiesT:'Troféskåp', g_trophiesD:'Varje pris och belöning du någonsin vunnit.',
        g_achT:'Prestationer', g_achD:'Lås upp märken medan du klättrar. Hur långt når du?',
        g_hTraining:'TRÄNINGSPLAN', g_hTrainingS:'Öva mot AI:n',
        g_hSchedule:'MATCHSCHEMA', g_hScheduleS:'Dina kommande ligamatcher',
        g_hTrophies:'TROFÉSKÅP', g_hTrophiesS:'Varje vunnet pris',
        g_hAch:'PRESTATIONER', g_hAchS:'Milstolpar & märken',
        g_trainHint:'Välj din motståndare. Matchen börjar direkt — inga mynt på spel.',
        g_rookie:'Nybörjare', g_veteran:'Veteran', g_master:'Mästare',
        g_easy:'Lätt', g_medium:'Medel', g_hard:'Svår',
        g_rookieD:'Spelar slumpmässiga kort. Perfekt för uppvärmning.',
        g_veteranD:'Spelar smart — sparar attacker till rätt ögonblick.',
        g_masterD:'Skoningslös. Straffar dig i samma sekund du missar.',
        g_enterTraining:'STARTA TRÄNING', g_starting:'Startar…',
        g_loadFixtures:'Laddar dina matcher…',
        g_noFixturesT:'Inga matcher än', g_noFixturesS:'Gå med i Ligan för att få ditt säsongsschema.',
        g_schedErr:'Kunde inte ladda schemat', g_season:'Säsong', g_fixtures:'matcher',
        g_nextUp:'NÄSTA', g_liveNow:'● LIVE NU', g_soon:'snart',
        g_openCabinet:'Öppnar skåpet…', g_emptyCabT:'Skåpet är tomt… än så länge',
        g_emptyCabS:'Vinn matcher, hämta belöningar och avsluta ligasäsonger för att fylla det.',
        g_trophyErr:'Kunde inte ladda troféer', g_totalWon:'Totalt vunnet över',
        g_reward:'belöning', g_rewards:'belöningar',
        g_unlocked:'UPPLÅST', g_badgesUnlocked:'Märken upplåsta — fortsätt spela för att samla alla',
        g_tryLater:'Försök igen senare', g_vs:'mot', g_bot:'BOT',
        ach_firstSteps:'Första stegen', ach_firstStepsD:'Spela ditt första spel',
        ach_warm:'Uppvärmd', ach_warmD:'Spela 10 spel',
        ach_seasoned:'Rutinerad spelare', ach_seasonedD:'Spela 50 spel',
        ach_firstWin:'Första segern', ach_firstWinD:'Vinn ditt första spel',
        ach_habit:'Vinnarvana', ach_habitD:'Vinn 10 spel',
        ach_champion:'Mästare', ach_championD:'Vinn 50 spel',
        ach_collector:'Myntsamlare', ach_collectorD:'Ha 10 000 mynt',
        ach_roller:'Höjdare', ach_rollerD:'Ha 100 000 mynt',
        ach_victor:'Turneringsvinnare', ach_victorD:'Vinn en turnering',
        ach_skilled:'Skicklig', ach_skilledD:'Nå 1300 ELO',
        ach_elite:'Elit', ach_eliteD:'Nå 1600 ELO',
        forgotPw:'Glömt lösenordet?', email:'E-post', optional:'valfritt',
        emailHint:'Lägg till en e-post så kan du återställa ditt konto om du glömmer lösenordet.',
        or:'eller', playAsGuest:'Spela som gäst', resetPw:'Återställ lösenord',
        resetHint:'Ange ditt användarnamn och e-posten du registrerade dig med för att ange ett nytt lösenord.',
        newPassword:'Nytt lösenord', backToLogin:'← Tillbaka till inloggning',
        fillAll:'Fyll i alla fält', pwResetOk:'Lösenordet återställt — du kan nu logga in',
        welcomeBack:'Välkommen tillbaka', statRating:'Rankning', statWins:'Vinster', statWinRate:'Vinstandel',
        chooseAvatar:'Välj din avatar', chooseAvatarSub:'Välj en karaktär — tryck för att använda', avatarUpdated:'Avatar uppdaterad!',
      },
    },
  };
  function t(key){
    const d = I18N.dict[I18N.current] || I18N.dict.en;
    return (d && d[key] != null) ? d[key] : (I18N.dict.en[key] != null ? I18N.dict.en[key] : key);
  }
  function applyI18n(){
    document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder = t(el.dataset.i18nPh); });
    // Refresh dynamic UI bits that build their own text
    try{ if(typeof refreshSoundLabel==='function') refreshSoundLabel(); }catch(e){}
  }
  function setLang(code){
    if(!I18N.dict[code]) return;
    I18N.current = code;
    localStorage.setItem('uno_lang', code);
    document.documentElement.lang = code;
    document.documentElement.dir = (code==='ar') ? 'rtl' : 'ltr';
    applyI18n();
    const tag=document.getElementById('authLangTag');
    if(tag) tag.textContent = code.toUpperCase();
  }
  function showLangPicker(){
    const old=document.getElementById('langPicker'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.id='langPicker';
    ov.style.cssText='position:fixed;inset:0;z-index:1200;background:rgba(4,6,14,.82);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;animation:gcIn .25s ease';
    ov.innerHTML=`
      <div style="width:min(360px,94vw);background:linear-gradient(180deg,rgba(28,32,57,.97),rgba(17,21,38,.99));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.7)">
        <div style="font-family:'Bangers',cursive;font-size:24px;letter-spacing:2px;color:#fff;text-align:center;margin-bottom:4px">🌐 ${t('chooseLanguage')}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
          ${I18N.langs.map(l=>`
            <button class="lang-opt" data-lang="${l.code}" style="display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:12px;cursor:pointer;font-family:inherit;text-align:left;
              background:${l.code===I18N.current?'rgba(245,158,11,.12)':'rgba(255,255,255,.03)'};
              border:1.5px solid ${l.code===I18N.current?'#F59E0B':'rgba(255,255,255,.07)'};color:#fff">
              <span style="font-size:24px">${l.flag}</span>
              <span style="flex:1;font-weight:800;font-size:14px">${l.name}</span>
              ${l.code===I18N.current?'<span style="color:#F59E0B;font-weight:900">✓</span>':''}
            </button>`).join('')}
        </div>
        <button id="langPickerClose" style="width:100%;margin-top:14px;padding:12px;background:transparent;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${t('close')}</button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.lang-opt').forEach(b=>b.addEventListener('click',()=>{
      setLang(b.dataset.lang);
      ov.remove();
      toast('🌐 '+I18N.langs.find(l=>l.code===b.dataset.lang).name,'s');
    }));
    ov.querySelector('#langPickerClose').addEventListener('click',()=>ov.remove());
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }

  /* ═══ SEASONAL THEMES ═══ */
  const THEMES={
    neon:     {name:'Neon Rush',      icon:'🃏', cls:'',               particle:null,    count:0,  desc:'The classic warm-gold table'},
    cyber:    {name:'Cyber Neon',     icon:'🌀', cls:'theme-cyber',    particle:'spark', count:26, desc:'Electric cyan & magenta'},
    winter:   {name:'Winter Frost',   icon:'❄️', cls:'theme-winter',   particle:'snow',  count:42, desc:'Cool blue with falling snow'},
    summer:   {name:'Summer Tropical',icon:'🌴', cls:'theme-summer',   particle:'petal', count:26, desc:'Warm sunset casino glow'},
    halloween:{name:'Halloween Glow', icon:'🎃', cls:'theme-halloween',particle:'ember', count:30, desc:'Dark purple with rising embers'},
    gold:     {name:'Gold Royale',    icon:'👑', cls:'theme-gold',     particle:'dust',  count:34, desc:'Anniversary golden dust'},
  };
  const Theme={
    current:'neon',
    order:['neon','cyber','winter','summer','halloween','gold'],
    autoByMonth(){
      const m=new Date().getMonth();
      if(m===11||m===0) return 'winter';
      if(m===9) return 'halloween';
      if(m>=5&&m<=7) return 'summer';
      return 'neon';
    },
    init(){
      this.current=localStorage.getItem('uno_theme')||this.autoByMonth();
      if(!THEMES[this.current]) this.current='neon';
      this.apply(this.current,true);
    },
    apply(id,silent){
      if(!THEMES[id]) id='neon';
      this.current=id;
      try{ localStorage.setItem('uno_theme',id); }catch(e){}
      const scr=document.getElementById('lobby-screen');
      if(scr){
        Object.values(THEMES).forEach(t=>{ if(t.cls) scr.classList.remove(t.cls); });
        if(THEMES[id].cls) scr.classList.add(THEMES[id].cls);
      }
      _buildWeather(id);
      if(!silent) toast(`${THEMES[id].icon} ${THEMES[id].name}`,'s');
    },
  };
  function _buildWeather(id){
    const host=document.getElementById('lobbyWeather');
    if(!host) return;
    host.innerHTML='';
    const t=THEMES[id];
    if(!t||!t.particle) return;
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    for(let i=0;i<t.count;i++){
      const p=document.createElement('div');
      p.className='wp '+t.particle;
      const sz=3+Math.random()*6;
      const dur=(t.particle==='ember'||t.particle==='spark')?(7+Math.random()*8):(8+Math.random()*11);
      p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;`+
        `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
        `--drift:${((Math.random()*2-1)*90).toFixed(0)}px;opacity:${(.3+Math.random()*.55).toFixed(2)};`;
      host.appendChild(p);
    }
  }
  function showThemePicker(){
    const old=document.getElementById('themePicker'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.id='themePicker';
    ov.style.cssText='position:fixed;inset:0;z-index:1200;background:rgba(4,6,14,.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;padding:20px;animation:gcIn .25s ease';
    ov.innerHTML=`
      <div style="width:min(440px,95vw);max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,rgba(28,32,57,.97),rgba(17,21,38,.99));border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:24px;box-shadow:0 40px 100px rgba(0,0,0,.75)">
        <div style="font-family:'Bangers',cursive;font-size:26px;letter-spacing:2px;color:#fff;text-align:center">🎨 SEASON THEME</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin:3px 0 16px;font-weight:600">Pick the lobby atmosphere — it changes the whole vibe</div>
        <div style="display:flex;flex-direction:column;gap:9px">
          ${Theme.order.map(id=>{
            const th=THEMES[id], on=id===Theme.current;
            return `<button class="theme-opt" data-th="${id}" style="display:flex;align-items:center;gap:13px;padding:13px 14px;border-radius:14px;cursor:pointer;font-family:inherit;text-align:left;
              background:${on?'rgba(245,158,11,.13)':'rgba(255,255,255,.03)'};
              border:1.5px solid ${on?'#F59E0B':'rgba(255,255,255,.07)'};color:#fff;transition:all .18s">
              <span style="font-size:28px">${th.icon}</span>
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:800;font-size:14px">${esc(th.name)}</span>
                <span style="display:block;font-size:11px;color:rgba(255,255,255,.5);font-weight:600">${esc(th.desc)}</span>
              </span>
              ${on?'<span style="color:#F59E0B;font-weight:900;font-size:16px">✓</span>':''}
            </button>`;
          }).join('')}
        </div>
        <button id="themePickerClose" style="width:100%;margin-top:14px;padding:12px;background:transparent;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${t('close')}</button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.theme-opt').forEach(b=>b.addEventListener('click',()=>{
      Theme.apply(b.dataset.th);
      ov.remove();
    }));
    ov.querySelector('#themePickerClose').addEventListener('click',()=>ov.remove());
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }

  /* ═══════════════════════════════════════════
    SEASONAL EVENTS — temporary live overlay layered ABOVE the theme.
    Theme = atmosphere/foundation · Event = limited-time live layer.
    Server-driven via GET /api/event; everything here is presentation.
    ═══════════════════════════════════════════ */
  const EVENT={
    data:null,
    _cd:null, _ann:null, _annIdx:0,

    async load(){
      try{
        const d=await apiFetch('/api/event');
        this.data=(d&&d.active)?d:null;
      }catch(e){ this.data=null; }
      this.apply();
    },

    // Rebuild the whole event layer — safe to call on every goLobby().
    apply(){
      const scr=document.getElementById('lobby-screen');
      const layer=document.getElementById('eventLayer');
      const slot=document.getElementById('eventBannerSlot');
      if(this._cd){ clearInterval(this._cd); this._cd=null; }
      if(this._ann){ clearInterval(this._ann); this._ann=null; }
      if(scr){
        [...scr.classList].forEach(c=>{ if(c.indexOf('event-')===0) scr.classList.remove(c); });
        scr.style.removeProperty('--ev'); scr.style.removeProperty('--ev2');
      }
      if(layer) layer.innerHTML='';
      if(slot) slot.innerHTML='';
      const d=this.data;
      if(!d){                                            // no active event → plain lobby
        document.body.style.removeProperty('--ev');
        document.body.style.removeProperty('--ev2');
        return;
      }
      if(scr){
        scr.classList.add('event-active','event-'+d.id);
        scr.style.setProperty('--ev',d.color||'#FFD23F');
        scr.style.setProperty('--ev2',d.color2||'#FF8A00');
      }
      // also expose event colours globally so in-room ambiance can use them
      document.body.style.setProperty('--ev',d.color||'#FFD23F');
      document.body.style.setProperty('--ev2',d.color2||'#FF8A00');
      this._buildProps(d.prop);
      this._buildBanner(d);
      this._startCountdown(d);
      this._startAnnouncements(d);
      setTimeout(()=>this._maybeIntro(d),900);           // entry cinematic after lobby settles
    },

    /* ── temporary particles / floating lobby props ── */
    _buildProps(prop){
      const host=document.getElementById('eventLayer');
      if(!host) return;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const coarse=matchMedia('(pointer:coarse)').matches;
      if(prop==='confetti'){
        const cols=['#FFD23F','#FF8A00','#FFF1B8','#FFB454','#FF5577'];
        const n=coarse?22:40;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-confetti';
          const dur=5+Math.random()*6;
          p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;background:${cols[i%cols.length]};`+
            `width:${(5+Math.random()*5).toFixed(0)}px;height:${(8+Math.random()*8).toFixed(0)}px;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sway:${((Math.random()*2-1)*70).toFixed(0)}px;`;
          host.appendChild(p);
        }
      }else if(prop==='pumpkin'||prop==='lantern'){
        const emoji=prop==='pumpkin'?'🎃':'🏮';
        const n=coarse?8:14;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-prop '+(prop==='lantern'?'rise':'float');
          p.textContent=emoji;
          const dur=11+Math.random()*10;
          p.style.cssText=`left:${(Math.random()*96+2).toFixed(1)}%;font-size:${(20+Math.random()*22).toFixed(0)}px;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sway:${((Math.random()*2-1)*60).toFixed(0)}px;opacity:${(.5+Math.random()*.4).toFixed(2)};`;
          host.appendChild(p);
        }
      }else if(prop==='firework'){
        const n=coarse?4:7;
        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.className='ev-fw';
          const dur=2.6+Math.random()*2.2;
          p.style.cssText=`left:${(Math.random()*84+8).toFixed(1)}%;top:${(Math.random()*46+8).toFixed(1)}%;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`;
          host.appendChild(p);
        }
      }
    },

    /* ── animated lobby banner (impossible to miss) ── */
    _buildBanner(d){
      const slot=document.getElementById('eventBannerSlot');
      if(!slot) return;
      const first=(d.announcements&&d.announcements[0])||d.tagline||'';
      slot.innerHTML=`
        <button class="ev-banner" onclick="EVENT.openMissions()" aria-label="${esc(d.name)} — open event">
          <div class="ev-banner-sheen"></div>
          <div class="ev-ribbon">LIVE EVENT</div>
          <div class="ev-banner-logo">${d.logo||d.icon||'🎉'}</div>
          <div class="ev-banner-mid">
            <div class="ev-banner-name">${esc(d.name)}</div>
            <div class="ev-banner-ann" id="evAnn">${esc(first)}</div>
          </div>
          <div class="ev-banner-right">
            <div class="ev-cd" id="evCd">—</div>
            <div class="ev-cd-lbl">⏳ ends in</div>
          </div>
          <div class="ev-banner-cta">🎯 Missions ›</div>
        </button>`;
    },

    _fmtLeft(ms){
      if(ms<=0) return 'Ended';
      const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
      return d>0?`${d}d ${h}h`:h>0?`${h}h ${m}m`:`${m}m`;
    },
    _startCountdown(d){
      const tick=()=>{ const el=document.getElementById('evCd'); if(el) el.textContent=this._fmtLeft(d.endsAt-Date.now()); };
      tick();
      this._cd=setInterval(tick,30000);
    },
    _startAnnouncements(d){
      const list=(d.announcements&&d.announcements.length)?d.announcements:[d.tagline||''];
      if(list.length<2) return;
      this._annIdx=0;
      this._ann=setInterval(()=>{
        const el=document.getElementById('evAnn'); if(!el) return;
        this._annIdx=(this._annIdx+1)%list.length;
        el.classList.add('swap');
        setTimeout(()=>{ el.textContent=list[this._annIdx]; el.classList.remove('swap'); },260);
      },5200);
    },

    /* ── entry cinematic — plays once per event ── */
    _maybeIntro(d){
      let seen=false;
      try{ seen=localStorage.getItem('uno_event_seen_'+d.id)==='1'; }catch(e){}
      if(seen) return;
      if(!document.getElementById('lobby-screen')?.classList.contains('active')) return;
      this.playIntro(d);
      try{ localStorage.setItem('uno_event_seen_'+d.id,'1'); }catch(e){}
    },
    playIntro(d){
      const ov=document.createElement('div');
      ov.className='ev-intro';
      ov.style.setProperty('--ev',d.color||'#FFD23F');
      ov.style.setProperty('--ev2',d.color2||'#FF8A00');
      ov.innerHTML=`
        <div class="ev-intro-glow"></div>
        <div class="ev-intro-burst"></div>
        <div class="ev-intro-logo">${d.logo||d.icon||'🎉'}</div>
        <div class="ev-intro-kicker">LIMITED-TIME EVENT</div>
        <div class="ev-intro-name">${esc(d.name)}</div>
        <div class="ev-intro-tag">${esc(d.tagline||'')}</div>
        <div class="ev-intro-hint">tap to enter</div>`;
      document.body.appendChild(ov);
      try{ SFX&&SFX.play&&SFX.play('win'); }catch(e){}
      this._introBurst(ov);
      const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
      let closed=false;
      const close=()=>{ if(closed) return; closed=true; ov.classList.add('out'); setTimeout(()=>ov.remove(),420); };
      ov.addEventListener('click',close);
      setTimeout(()=>{ if(document.body.contains(ov)) close(); },rm?2400:4400);
    },
    _introBurst(host){
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const burst=host.querySelector('.ev-intro-burst');
      if(!burst) return;
      const cols=['#FFD23F','#FF8A00','#FFF1B8','#7DF9FF','#FF5577'];
      for(let i=0;i<30;i++){
        const s=document.createElement('div');
        s.className='ev-spark';
        const ang=Math.random()*Math.PI*2, dist=90+Math.random()*240;
        s.style.cssText=`background:${cols[i%cols.length]};`+
          `--tx:${(Math.cos(ang)*dist).toFixed(0)}px;--ty:${(Math.sin(ang)*dist).toFixed(0)}px;`+
          `animation-delay:${(Math.random()*.22).toFixed(2)}s;`;
        burst.appendChild(s);
      }
      setTimeout(()=>{ burst.innerHTML=''; },1900);
    },

    /* ── event missions panel ── */
    async openMissions(){
      const old=document.getElementById('evModal'); if(old) old.remove();
      const ov=document.createElement('div');
      ov.id='evModal';
      ov.innerHTML=`<div class="ev-modal"><div class="ev-modal-load"><div class="ev-spin"></div>Loading event…</div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener('mousedown',e=>{ if(e.target===ov) EVENT._closeModal(); });
      try{
        this.data=await apiFetch('/api/event');
        if(!this.data||!this.data.active){ this._closeModal(); toast('No event running right now','i'); return; }
        this._renderModal();
      }catch(e){
        const p=ov.querySelector('.ev-modal');
        if(p) p.innerHTML=`<div class="ev-modal-load" style="color:#f87171">Could not load event</div>`;
      }
    },
    _closeModal(){
      const ov=document.getElementById('evModal'); if(!ov) return;
      ov.classList.add('out'); setTimeout(()=>ov.remove(),220);
    },
    _renderModal(){
      const d=this.data, ov=document.getElementById('evModal'); if(!d||!ov) return;
      const panel=ov.querySelector('.ev-modal');
      panel.style.setProperty('--ev',d.color||'#FFD23F');
      panel.style.setProperty('--ev2',d.color2||'#FF8A00');
      const done=d.missions.filter(m=>m.claimed).length;
      const f=d.featured||{};
      panel.innerHTML=`
        <div class="ev-m-hero">
          <button class="ev-m-close" onclick="EVENT._closeModal()" aria-label="Close">×</button>
          <div class="ev-m-logo">${d.logo||d.icon||'🎉'}</div>
          <div class="ev-m-title">${esc(d.name)}</div>
          <div class="ev-m-sub">${esc(d.tagline||'')}</div>
          <div class="ev-m-cd">⏳ ${this._fmtLeft(d.endsAt-Date.now())} left · ${done}/${d.missions.length} claimed</div>
        </div>
        <div class="ev-m-body">
          <div class="ev-m-featured rar-${esc(f.rarity||'epic')}">
            <div class="ev-m-feat-ic">${f.icon||'🎁'}</div>
            <div class="ev-m-feat-txt">
              <div class="ev-m-feat-lbl">FEATURED REWARD</div>
              <div class="ev-m-feat-name">${esc(f.name||'Mystery Reward')}</div>
              <div class="ev-m-feat-desc">${esc(f.desc||'')}</div>
            </div>
            <div class="ev-m-feat-rar">${esc(String(f.rarity||'epic').toUpperCase())}</div>
          </div>
          <div class="ev-m-list">
            ${d.missions.map((m,i)=>{
              const pct=Math.min(100,Math.round(m.current/m.target*100));
              const state=m.claimed?'claimed':m.complete?'ready':'';
              return `<div class="ev-mission ${state}" style="animation-delay:${i*60}ms">
                <div class="ev-mission-ic">${m.claimed?'✅':m.icon}</div>
                <div class="ev-mission-main">
                  <div class="ev-mission-name">${esc(m.name)}</div>
                  <div class="ev-mission-desc">${esc(m.desc)} · ${m.current}/${m.target}</div>
                  <div class="ev-mission-bar"><div class="ev-mission-fill" style="width:${pct}%"></div></div>
                </div>
                <button class="ev-claim ${state}" ${(m.claimed||!m.complete)?'disabled':''} onclick="EVENT.claim('${m.id}')">
                  ${m.claimed?'CLAIMED':m.complete?('CLAIM 🪙'+m.reward.toLocaleString()):('🪙 '+m.reward.toLocaleString())}
                </button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    },
    async claim(mid){
      const icon=(this.data&&this.data.icon)||'🎉';
      try{
        const r=await apiFetch('/api/event/claim',{method:'POST',body:JSON.stringify({mission:mid})});
        if(S.user){ S.user.coins=r.coins; try{localStorage.setItem('uno_user',JSON.stringify(S.user));}catch(e){} }
        ['hcoins','scoins','heroCoins'].forEach(id=>{ if(document.getElementById(id)) _animateCount(id,r.coins); });
        try{ SFX&&SFX.play&&SFX.play('uno'); }catch(e){}
        toast(`${icon} +${r.reward.toLocaleString()} coins!`,'s');
        this._claimBurst();
        this.data=await apiFetch('/api/event');
        this._renderModal();
      }catch(e){ toast(e.message||'Could not claim','e'); }
    },
    _claimBurst(){
      const host=document.getElementById('eventLayer');
      if(!host||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const cols=['#FFD23F','#FF8A00','#FFF1B8','#FFB454'];
      for(let i=0;i<24;i++){
        const p=document.createElement('div');
        p.className='ev-confetti burst';
        const dur=2+Math.random()*1.6;
        p.style.cssText=`left:${(40+Math.random()*20).toFixed(1)}%;top:36%;background:${cols[i%cols.length]};`+
          `width:7px;height:11px;animation-duration:${dur.toFixed(1)}s;`+
          `--sway:${((Math.random()*2-1)*170).toFixed(0)}px;`;
        host.appendChild(p);
        setTimeout(()=>p.remove(),dur*1000+250);
      }
    },

    /* ── event rooms ── */
    // The featured (spotlit) room rotates every 15s; loadRooms re-renders every 5s.
    pickFeatured(rooms){
      if(!this.data||!rooms||!rooms.length) return null;
      return rooms[Math.floor(Date.now()/15000)%rooms.length].id;
    },
    // Fill the featured room's particle host (one room only → cheap).
    decorateRooms(){
      if(!this.data||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      document.querySelectorAll('.rt-ev-fx[data-evfx]').forEach(host=>{
        host.removeAttribute('data-evfx');
        for(let i=0;i<7;i++){
          const s=document.createElement('div');
          s.className='rt-ev-spark';
          const dur=2.4+Math.random()*2;
          s.style.cssText=`left:${(8+Math.random()*84).toFixed(0)}%;`+
            `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
            `--sd:${((Math.random()*2-1)*22).toFixed(0)}px;`;
          host.appendChild(s);
        }
      });
    },

    /* ── cinematic event-room entry ── */
    roomEnter(joinFn){
      const d=this.data;
      if(!d||matchMedia('(prefers-reduced-motion:reduce)').matches){ joinFn(); return; }
      const ov=document.createElement('div');
      ov.className='ev-room-wipe';
      ov.style.setProperty('--ev',d.color||'#FFD23F');
      ov.style.setProperty('--ev2',d.color2||'#FF8A00');
      ov.innerHTML=`<div class="ev-room-wipe-logo">${d.logo||d.icon||'🎉'}</div>`;
      document.body.appendChild(ov);
      try{ SFX&&SFX.play&&SFX.play('turn'); }catch(e){}
      setTimeout(joinFn,300);                                    // swap screens behind the wipe
      setTimeout(()=>{ ov.classList.add('out'); setTimeout(()=>ov.remove(),380); },780);
    },

    /* ── in-room event ambiance (event-tinted vignette + soft particles) ── */
    enterRoomAmbiance(){
      if(!this.data) return;
      document.body.classList.add('in-event-room');
      let amb=document.getElementById('eventRoomAmb');
      if(!amb){
        amb=document.createElement('div');
        amb.id='eventRoomAmb';
        amb.innerHTML='<div class="era-vignette"></div><div class="era-fx"></div>';
        document.body.appendChild(amb);
      }
      const fx=amb.querySelector('.era-fx');
      fx.innerHTML='';
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const n=matchMedia('(pointer:coarse)').matches?6:11;
      for(let i=0;i<n;i++){
        const p=document.createElement('div');
        p.className='era-p';
        const dur=9+Math.random()*9;
        p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;`+
          `width:${(3+Math.random()*4).toFixed(0)}px;height:${(3+Math.random()*4).toFixed(0)}px;`+
          `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
          `--sd:${((Math.random()*2-1)*55).toFixed(0)}px;opacity:${(.25+Math.random()*.4).toFixed(2)};`;
        fx.appendChild(p);
      }
    },
    exitRoomAmbiance(){
      document.body.classList.remove('in-event-room');
      const amb=document.getElementById('eventRoomAmb');
      if(amb){ const fx=amb.querySelector('.era-fx'); if(fx) fx.innerHTML=''; }
    },
  };
  window.EVENT=EVENT;   // referenced from inline onclick handlers

  /* ═══════════════════════════════════════════
    SOUND SYSTEM (Web Audio API)
    ═══════════════════════════════════════════ */
  const Voice = {
    enabled: true,
    voice: null,
    _ready: false,
    _init(){
      if(!('speechSynthesis' in window)) { this.enabled = false; return; }
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice =
          voices.find(v => /en-US/i.test(v.lang) && /female|samantha|google.*us/i.test(v.name)) ||
          voices.find(v => /en-US/i.test(v.lang)) ||
          voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
        this._ready = true;
      };
      pickVoice();
      if(!this._ready) window.speechSynthesis.onvoiceschanged = pickVoice;
    },
    say(text){
      try{
        if(typeof soundOn !== 'undefined' && !soundOn) return;
        if(!this.enabled) return;
        if(!this._ready) this._init();
        if(!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = .95; u.pitch = 1; u.volume = .9;
        if(this.voice) u.voice = this.voice;
        window.speechSynthesis.speak(u);
      }catch(e){}
    },
    sayDraw(count){
      const n = Math.max(1, count|0);
      const words = {1:'draw card',2:'draw two',3:'draw three',4:'draw four',5:'draw five',6:'draw six',7:'draw seven',8:'draw eight',9:'draw nine',10:'draw ten'};
      this.say(words[n] || `draw ${n}`);
    }
  };

  /* ═══════════════════════════════════════════
    VOICE CHAT — peer-to-peer over WebRTC
    Uses the existing socket.io connection only for SDP/ICE signaling.
    Audio itself goes directly between players (no server bandwidth).
    ═══════════════════════════════════════════ */
  const VoiceChat = {
    isOn: false,
    isMuted: false,
    localStream: null,
    peers: new Map(),       // remoteUserId -> RTCPeerConnection
    audioEls: new Map(),    // remoteUserId -> HTMLAudioElement
    mutedPeers: new Set(),  // remote users we silenced locally
    _level: { ctx:null, analyser:null, raf:null, lastSpeaking:false },
    _stunServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free public TURN relays (Open Relay Project) — needed when both
      // peers are behind symmetric NAT (mobile carriers, some ISPs)
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],

    async toggle(){
      if (!S.roomId) return toast('Join a game first','i');
      if (this.isOn) return this.leave();
      try {
        await this.join();
      } catch(e){
        console.warn('[Voice] join failed', e);
        toast(e.name === 'NotAllowedError' ? '🎤 Microphone permission denied' : 'Voice chat failed','e');
      }
    },

    async join(){
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true },
        video: false,
      });
      this.isOn = true;
      this.isMuted = false;
      this._updateBtn();
      this._startLevelMonitor();
      // Tell others we joined — they will reach back with offers
      S.socket?.emit('voice:join');
      toast('🎤 Voice chat ON','s');
      // Refresh panels so the per-peer mute buttons can appear (3+ players only)
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    leave(){
      this.isOn = false;
      this._stopLevelMonitor();
      // Tell peers we left so they tear down on their side too
      S.socket?.emit('voice:leave');
      // Close all peer connections
      this.peers.forEach((pc) => { try{ pc.close(); }catch(e){} });
      this.peers.clear();
      // Remove remote audio elements
      this.audioEls.forEach((a) => { try{ a.srcObject = null; a.remove(); }catch(e){} });
      this.audioEls.clear();
      this.mutedPeers.clear();
      // Stop local mic
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }
      // Clear any speaking indicators on opponents
      document.querySelectorAll('.opp-avatar.speaking').forEach(el => el.classList.remove('speaking'));
      this._updateBtn();
      // Refresh panels so mute buttons disappear
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    toggleMute(){
      if (!this.isOn || !this.localStream) return;
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = !this.isMuted; });
      if (this.isMuted) S.socket?.emit('voice:speaking', { speaking:false });
      this._updateBtn();
      toast(this.isMuted ? '🔇 Mic muted' : '🎤 Mic on','i');
    },

    // Per-peer local mute — silences a specific player on YOUR end only.
    // The other player keeps their mic open and doesn't know you muted
    // them; the rest of the room still hears them normally.
    toggleMutePeer(peerId){
      if (this.mutedPeers.has(peerId)) {
        this.mutedPeers.delete(peerId);
        const a = this.audioEls.get(peerId); if (a) a.muted = false;
        toast('🔊 Unmuted player','i');
      } else {
        this.mutedPeers.add(peerId);
        const a = this.audioEls.get(peerId); if (a) a.muted = true;
        toast('🔇 Muted player on your end','i');
      }
      // Re-render opponent panels so the button reflects the new state
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    _updateBtn(){
      const btn = document.getElementById('micBtn');
      if (!btn) return;
      btn.classList.toggle('on', this.isOn && !this.isMuted);
      btn.classList.toggle('muted', this.isOn && this.isMuted);
      btn.title = this.isOn ? (this.isMuted ? 'Unmute (long press to leave)' : 'Mute (long press to leave)') : 'Voice chat';
    },

    _peerConfig(){ return { iceServers: this._stunServers }; },

    _ensurePeer(remoteId, isInitiator){
      if (this.peers.has(remoteId)) return this.peers.get(remoteId);
      const pc = new RTCPeerConnection(this._peerConfig());

      // Send our local audio track(s)
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
      }

      // Receive remote audio
      pc.ontrack = (ev) => {
        console.log('[Voice] ontrack from', remoteId, 'kind:', ev.track.kind);
        let audio = this.audioEls.get(remoteId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.controls = false;
          document.getElementById('voiceAudios')?.appendChild(audio);
          this.audioEls.set(remoteId, audio);
        }
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        audio.srcObject = stream;
        // Honor any prior local mute decision for this peer
        audio.muted = this.mutedPeers.has(remoteId);
        // Some browsers/Safari refuse autoplay until we explicitly call play()
        audio.play().catch((e) => console.warn('[Voice] audio play() blocked:', e?.name));
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          S.socket?.emit('voice:signal', { to: remoteId, kind: 'ice', payload: ev.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Voice]', remoteId, 'ice state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('[Voice]', remoteId, 'conn state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          toast('🎧 Voice connected','s');
        }
        if (['failed','disconnected','closed'].includes(pc.connectionState)) {
          this._dropPeer(remoteId);
        }
      };

      this.peers.set(remoteId, pc);

      if (isInitiator) {
        (async () => {
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            S.socket?.emit('voice:signal', { to: remoteId, kind: 'offer', payload: pc.localDescription });
          } catch(e){ console.warn('[Voice] offer failed', e); }
        })();
      }
      return pc;
    },

    async _handleSignal({ from, kind, payload }){
      if (!this.isOn) return; // Ignore if we're not in voice chat
      let pc = this.peers.get(from);
      if (!pc && kind === 'offer') pc = this._ensurePeer(from, false);
      if (!pc) return;
      try {
        if (kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          S.socket?.emit('voice:signal', { to: from, kind: 'answer', payload: pc.localDescription });
        } else if (kind === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (kind === 'ice') {
          if (payload) await pc.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch(e){ console.warn('[Voice] signal handling failed', e); }
    },

    _dropPeer(remoteId){
      const pc = this.peers.get(remoteId);
      if (pc) { try{ pc.close(); }catch(e){} this.peers.delete(remoteId); }
      const a = this.audioEls.get(remoteId);
      if (a) { try{ a.srcObject = null; a.remove(); }catch(e){} this.audioEls.delete(remoteId); }
      this._setRemoteSpeaking(remoteId, false);
    },

    _setRemoteSpeaking(remoteId, speaking){
      const panel = document.querySelector(`.opanel[data-pid="${remoteId}"] .opp-avatar`);
      if (!panel) return;
      panel.classList.toggle('speaking', !!speaking);
    },

    // Local mic level monitor — emits voice:speaking when above/below threshold
    _startLevelMonitor(){
      if (!this.localStream) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(this.localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        this._level.ctx = ctx;
        this._level.analyser = analyser;
        const tick = () => {
          if (!this.isOn) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const speaking = !this.isMuted && rms > 0.06;
          if (speaking !== this._level.lastSpeaking) {
            this._level.lastSpeaking = speaking;
            S.socket?.emit('voice:speaking', { speaking });
          }
          this._level.raf = requestAnimationFrame(tick);
        };
        tick();
      } catch(e){ console.warn('[Voice] level monitor failed', e); }
    },
    _stopLevelMonitor(){
      if (this._level.raf) cancelAnimationFrame(this._level.raf);
      try{ this._level.ctx?.close(); }catch(e){}
      this._level = { ctx:null, analyser:null, raf:null, lastSpeaking:false };
    },
  };
  const SFX={
    ctx:null,
    init(){if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();},
    play(type){
      try{
        if(typeof soundOn!=='undefined'&&!soundOn)return;
        this.init();
        const c=this.ctx,o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);
        const now=c.currentTime;
        switch(type){
          case'play':o.frequency.setValueAtTime(523,now);o.frequency.setValueAtTime(659,now+.08);g.gain.setValueAtTime(.12,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.start(now);o.stop(now+.2);break;
          case'draw':o.frequency.setValueAtTime(330,now);g.gain.setValueAtTime(.08,now);g.gain.exponentialRampToValueAtTime(.001,now+.15);o.start(now);o.stop(now+.15);break;
          case'uno':o.frequency.setValueAtTime(440,now);o.frequency.setValueAtTime(554,now+.1);o.frequency.setValueAtTime(659,now+.2);g.gain.setValueAtTime(.15,now);g.gain.exponentialRampToValueAtTime(.001,now+.4);o.start(now);o.stop(now+.4);break;
          case'win':o.frequency.setValueAtTime(523,now);o.frequency.setValueAtTime(659,now+.15);o.frequency.setValueAtTime(784,now+.3);g.gain.setValueAtTime(.15,now);g.gain.exponentialRampToValueAtTime(.001,now+.6);o.start(now);o.stop(now+.6);break;
          case'turn':o.frequency.setValueAtTime(880,now);g.gain.setValueAtTime(.06,now);g.gain.exponentialRampToValueAtTime(.001,now+.1);o.start(now);o.stop(now+.1);break;
          case'error':o.frequency.setValueAtTime(200,now);g.gain.setValueAtTime(.1,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.start(now);o.stop(now+.2);break;
          case'hover':o.type='sine';o.frequency.setValueAtTime(1320,now);g.gain.setValueAtTime(.02,now);g.gain.exponentialRampToValueAtTime(.0008,now+.06);o.start(now);o.stop(now+.06);break;
          case'click':o.type='triangle';o.frequency.setValueAtTime(620,now);o.frequency.exponentialRampToValueAtTime(960,now+.05);g.gain.setValueAtTime(.07,now);g.gain.exponentialRampToValueAtTime(.001,now+.12);o.start(now);o.stop(now+.12);break;
          case'open':o.type='sine';o.frequency.setValueAtTime(420,now);o.frequency.exponentialRampToValueAtTime(720,now+.12);g.gain.setValueAtTime(.06,now);g.gain.exponentialRampToValueAtTime(.001,now+.18);o.start(now);o.stop(now+.18);break;
        }
      }catch(e){}
    }
  };

  /* ═══════════════════════════════════════════
    CHAT SYSTEM
    ═══════════════════════════════════════════ */
  const Chat={open:false,activeTab:'chat',unread:0,lastSent:0,spamCount:0,history:[]};

  function toggleChat(){
    Chat.open=!Chat.open;
    document.getElementById('chatPanel').classList.toggle('open',Chat.open);
    if(Chat.open){Chat.unread=0;updateChatBadge();scrollChatBottom();}
  }
  function showChatFab(show){
    document.getElementById('emojiBtn').classList.toggle('visible', show);
    document.getElementById('micBtn')?.classList.toggle('visible', show);
    if(!show){
      document.getElementById('emojiPicker').classList.remove('show');
      document.getElementById('friendsPanel').classList.remove('open'); Friends.open=false;
      if (typeof VoiceChat !== 'undefined' && VoiceChat.isOn) VoiceChat.leave();
    }
    document.getElementById('chatFab').classList.toggle('visible',show);
  }
  function switchChatTab(tab){
    Chat.activeTab=tab;
    document.getElementById('chatMsgs').style.display=tab==='chat'?'flex':'none';
    document.getElementById('activityMsgs').style.display=tab==='activity'?'flex':'none';
    const sm=document.getElementById('specMsgs'); if(sm) sm.style.display=tab==='spec'?'flex':'none';
    // Spectators chat in their own channel; players can only read it
    const inputAreaVisible = tab==='chat' || (tab==='spec' && S.isSpectator);
    document.getElementById('chatInputArea').style.display=inputAreaVisible?'flex':'none';
    document.getElementById('tabChat').classList.toggle('active',tab==='chat');
    document.getElementById('tabActivity').classList.toggle('active',tab==='activity');
    const ts=document.getElementById('tabSpec'); if(ts) ts.classList.toggle('active',tab==='spec');
    scrollChatBottom();
  }
  function addSpectatorMsg(msg){
    const c=document.getElementById('specMsgs'); if(!c) return;
    const isMe=msg.userId===S.user?.id;
    const d=document.createElement('div');d.className=`chat-msg ${isMe?'mine':'other'}`;
    d.innerHTML=`<div class="chat-name" style="color:#c4b5fd">👁️ ${esc(msg.username)}</div><div class="chat-text">${esc(msg.text)}</div><div class="chat-time">${fmtTime(msg.createdAt)}</div>`;
    c.appendChild(d);
    while(c.children.length>80)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='spec')scrollChatBottom();
    else if(!isMe&&S.isSpectator){Chat.unread++;updateChatBadge();}
  }
  function updateChatBadge(){
    const b=document.getElementById('chatBadge');
    if(Chat.unread>0){b.textContent=Chat.unread>9?'9+':Chat.unread;b.classList.add('show');}
    else b.classList.remove('show');
  }
  function scrollChatBottom(){
    const el=Chat.activeTab==='chat'?document.getElementById('chatMsgs'):document.getElementById('activityMsgs');
    setTimeout(()=>{el.scrollTop=el.scrollHeight;},50);
  }
  function fmtTime(ts){return new Date(ts||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
  function addChatMsg(msg){
    Chat.history.push(msg);if(Chat.history.length>50)Chat.history.shift();
    const c=document.getElementById('chatMsgs'),isMe=msg.userId===S.user?.id;
    const d=document.createElement('div');d.className=`chat-msg ${isMe?'mine':'other'}`;
    d.innerHTML=`${!isMe?`<div class="chat-name">${esc(msg.username)}</div>`:''}<div class="chat-text">${esc(msg.text)}</div><div class="chat-time">${fmtTime(msg.createdAt)}</div>`;
    c.appendChild(d);
    while(c.children.length>50)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='chat')scrollChatBottom();
    else if(!isMe){Chat.unread++;updateChatBadge();}
  }
  function addActivityMsg(text,type='game'){
    const c=document.getElementById('activityMsgs'),d=document.createElement('div');
    d.className=`activity-msg ${type}`;
    d.innerHTML=`${text} <span style="float:right;font-size:9px;color:var(--muted)">${fmtTime()}</span>`;
    c.appendChild(d);
    while(c.children.length>50)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='activity')scrollChatBottom();
  }
  function checkSpam(){
    const now=Date.now();
    if(now-Chat.lastSent<1500){Chat.spamCount++;if(Chat.spamCount>=3){document.getElementById('spamWarn').classList.add('show');setTimeout(()=>{document.getElementById('spamWarn').classList.remove('show');Chat.spamCount=0;},3000);return false;}}
    else Chat.spamCount=0;
    Chat.lastSent=now;return true;
  }
  function sendChat(){
    const input=document.getElementById('chatInput'),raw=input.value.trim();
    if(!raw||!S.roomId||raw.length>200)return;
    if(!checkSpam())return;
    input.value='';input.style.height='38px';
    // Spectators on the Watchers tab post into the watcher channel
    const spec = S.isSpectator && Chat.activeTab === 'spec';
    const evt = spec ? 'chat:spectator_send' : 'chat:send';
    S.socket.emit(evt,{text:raw},(res)=>{if(!res?.success)toast('Could not send message','e');});
  }
  function handleChatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}}
  function autoResizeTextarea(el){el.style.height='38px';el.style.height=Math.min(el.scrollHeight,80)+'px';}

  function initChatListeners(sk){
    sk.on('chat:message',(msg)=>{addChatMsg(msg);if(!Chat.open&&msg.userId!==S.user?.id)toast(`💬 ${msg.username}: ${msg.text.slice(0,30)}${msg.text.length>30?'...':''}`,'i');});
    sk.on('chat:history',({messages})=>{document.getElementById('chatMsgs').innerHTML='';messages.forEach(m=>addChatMsg(m));});
    sk.on('room:player_joined',({player})=>{const n=player?.username||'A player';addActivityMsg(`🟢 ${esc(n)} joined the room`,'join');toast(`${n} joined!`,'i');refreshRoom();});
    sk.on('room:player_left',({username})=>{addActivityMsg(`🔴 ${esc(username||'Player')} left`,'leave');toast(`${username||'Player'} left`,'w');refreshRoom();});
    sk.on('game:reaction',(data)=>{
      showReactionOnPanel(data.emoji, data.playerId);
    });

    /* Voice chat signaling */
    sk.on('voice:peers', ({ peers }) => {
      // Sent only to us right after we join — initiate offers to existing peers
      if (!VoiceChat.isOn) return;
      (peers || []).forEach((peerId) => VoiceChat._ensurePeer(peerId, true));
    });
    sk.on('voice:peer_joined', () => {
      // A new peer just joined voice. They will initiate to us — we just wait.
    });
    sk.on('voice:peer_left', ({ peerId }) => {
      VoiceChat._dropPeer(peerId);
    });
    sk.on('voice:signal', (data) => {
      VoiceChat._handleSignal(data);
    });
    sk.on('voice:speaking', ({ peerId, speaking }) => {
      VoiceChat._setRemoteSpeaking(peerId, speaking);
    });
    sk.on('friend:request',(data)=>{
      Friends.requests.push(data.from);
      updateFriendsNotif(Friends.requests.length);
      toast(`👥 ${data.from.username} sent you a friend request!`,'i');
    });
    sk.on('friend:accepted',(data)=>{
      toast(`🎉 ${data.by.username} accepted your friend request!`,'s');
      loadFriends();
    });
    sk.on('friend:invite',(data)=>{
      showInviteToast(data.from, data.roomId, data.code);
    });
    sk.on('tournament:update',(t)=>{
      if(Tourn.current?.id===t.id) renderTournament(t);
    });
    sk.on('tournament:match_ready',(data)=>{
      Tourn.pendingMatch = data;
      document.getElementById('matchInviteText').textContent=`vs ${data.opponent.username} — ${data.tournamentName}${data.round?` Round ${data.round}`:''}`;
      document.getElementById('matchInvite').classList.add('show');
      SFX.play('turn');
      toast('⚔️ Your match is ready!','s');
    });
    sk.on('tournament:won',(data)=>{
      toast(`🏆 You won the ${data.name} tournament! +${data.prize} coins 🪙`,'s');
      if(S.user){ S.user.coins=(S.user.coins||0)+data.prize; localStorage.setItem('uno_user',JSON.stringify(S.user)); }
    });
    sk.on('tournament:finished',(data)=>{
      toast(`🏆 Tournament finished! Winner: ${data.winner.username}`,'i');
      if(Tourn.current?.id===data.tournamentId){
        Tourn.current.status='finished';
        Tourn.current.winner=data.winner;
        renderTournament(Tourn.current);
      }
    });
    sk.on('game:uno_called',({username})=>{
      addActivityMsg(`🗣️ ${esc(username)} called UNO!`,'uno');SFX.play('uno');
      const d=document.createElement('div');d.className='uno-alert';d.textContent=`${username} — UNO!`;
      document.body.appendChild(d);setTimeout(()=>d.remove(),2000);
    });
    sk.on('game:started_notify',()=>{addActivityMsg('🎮 Game has started!','game');});
    sk.on('game:over_notify',({winner})=>{addActivityMsg(`🏆 ${esc(winner||'Someone')} won!`,'game');});
    sk.on('player:disconnected',({username})=>{addActivityMsg(`📡 ${esc(username)} disconnected`,'disconnect');});
    sk.on('player:reconnected',({username})=>{addActivityMsg(`✅ ${esc(username)} reconnected`,'join');});
  }

  /* ═══════════════════════════════════════════
    MAIN APP
    ═══════════════════════════════════════════ */
  const _host=window.location.origin;
  const API=_host+'/api';
  const SOCK=_host;

  const S={
    token:localStorage.getItem('uno_token'),
    user:(()=>{try{return JSON.parse(localStorage.getItem('uno_user')||'null');}catch(e){localStorage.removeItem('uno_user');return null;}})(),
    socket:null,roomId:null,
    roomsTimer:null,unoTimer:null,
    pendingWild:null,calledUNO:false,
    g:{myHand:[],myPlayable:[],players:[],topCard:null,currentTurn:null,direction:1,drawPileSize:108,turnPhase:'waiting',drawnCardId:null,stackDraw:0,spectatorHands:{},voteTally:{},myVote:null},
    isSpectator:false,
  };

  /* ═══ HELPERS ═══ */
  function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');
    // The ⚙ menus must never carry over open between screens —
    // they open only when the player taps the gear.
    document.getElementById('gameMenu')?.classList.remove('show');
    document.getElementById('lobbyMenu')?.classList.remove('show');
    // event-room ambiance only belongs on the room/game screens
    if(id!=='game-screen'&&id!=='room-screen') document.body.classList.remove('in-event-room');
    if(id!=='game-screen'){document.getElementById('emojiBtn')?.classList.remove('visible');document.getElementById('chatFab')?.classList.remove('visible');document.getElementById('emojiPicker')?.classList.remove('show');document.getElementById('micBtn')?.classList.remove('visible');if(typeof VoiceChat!=='undefined'&&VoiceChat.isOn)VoiceChat.leave();}}
  function toast(msg,type='i'){const w=document.getElementById('twrap'),t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;w.appendChild(t);setTimeout(()=>t.remove(),3500);}
  async function api(method,path,body){
    const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},body:body?JSON.stringify(body):undefined});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Error');return d;
  }
  // fetch-style helper: path already includes /api, opts = { method, body(stringified) }
  async function apiFetch(path,opts={}){
    const r=await fetch(_host+path,{
      method:opts.method||'GET',
      headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},
      body:opts.body,
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Request failed');
    return d;
  }
  function fmtV(v){return{skip:'⊘',reverse:'⇄',draw_two:'+2',wild:'★',wild_draw_four:'+4','0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'}[v]||v||'?';}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function isMe(id){return id===S.user?.id;}
  function myTurn(){return S.g.currentTurn===S.user?.id;}
  function canIDraw(){return myTurn()&&S.g.turnPhase==='must_play';}
  function canIPlay(){return myTurn()&&(S.g.turnPhase==='must_play'||S.g.turnPhase==='drew_card');}

  function buildCardHTML(color,value){
    const v=fmtV(value);
    if(color==='wild')return`<div class="wild-oval"></div><div class="card-tl">${v}</div><div class="wild-txt">${value==='wild_draw_four'?'+4':'★'}</div><div class="card-br">${v}</div>`;
    return`<div class="card-oval"></div><div class="card-tl">${v}</div><div class="card-num">${v}</div><div class="card-br">${v}</div>`;
  }

  /* ═══ AUTH ═══ */
  function switchTab(tab){
    document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('on',(i===0&&tab==='login')||(i===1&&tab==='register')));
    document.getElementById('lf').style.display=tab==='login'?'block':'none';
    document.getElementById('rf').style.display=tab==='register'?'block':'none';
    document.getElementById('aerr').textContent='';
  }
  function togglePw(id,btn){
    const inp=document.getElementById(id); if(!inp)return;
    const reveal=inp.type==='password';
    inp.type=reveal?'text':'password';
    btn.textContent=reveal?'🙈':'👁';
    btn.classList.toggle('on',reveal);
  }
  function showForgot(){
    document.getElementById('authMain').style.display='none';
    document.getElementById('forgotForm').style.display='block';
    document.getElementById('aerr').textContent='';
  }
  function hideForgot(){
    document.getElementById('forgotForm').style.display='none';
    document.getElementById('authMain').style.display='block';
    document.getElementById('aerr').textContent='';
  }
  async function doLogin(){
    const u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value;
    if(!u||!p)return setErr(t('fillAll'));
    try{const d=await api('POST','/auth/login',{username:u,password:p});onAuth(d.token,d.user);}catch(e){setErr(e.message);SFX.play('error');}
  }
  async function doRegister(){
    const u=document.getElementById('ru').value.trim(),p=document.getElementById('rp').value;
    if(!u||!p)return setErr(t('fillAll'));
    try{const d=await api('POST','/auth/register',{username:u,password:p});onAuth(d.token,d.user);}catch(err){setErr(err.message);SFX.play('error');}
  }
  async function doGuest(){
    try{const d=await api('POST','/auth/guest',{});onAuth(d.token,d.user);}catch(e){setErr(e.message);SFX.play('error');}
  }
  async function doResetPassword(){
    const u=document.getElementById('fu').value.trim();
    const e=document.getElementById('fe').value.trim();
    const p=document.getElementById('fp').value;
    if(!u||!e||!p)return setErr(t('fillAll'));
    try{
      await api('POST','/auth/reset',{username:u,email:e,newPassword:p});
      hideForgot(); switchTab('login');
      document.getElementById('lu').value=u;
      document.getElementById('fp').value='';
      toast('✅ '+t('pwResetOk'),'s');
    }catch(err){setErr(err.message);SFX.play('error');}
  }
  function onAuth(token,user){
    S.token=token;S.user=user;
    try{
      localStorage.setItem('uno_token',token);
      localStorage.setItem('uno_user',JSON.stringify(user));
    }catch(e){}
    // Reveal admin-only menu items for the admin user
    if(user?.username && user.username.toLowerCase().includes('mustapha')){
      const m=document.getElementById('adminPanelMenuItem');if(m)m.style.display='';
    }
    // A render error must never block login — show the lobby no matter what.
    try{ initSock(); }catch(e){ console.error('[Auth] initSock failed:',e); }
    try{ goLobby(); }
    catch(e){ console.error('[Auth] goLobby failed:',e); showScreen('lobby-screen'); }
  }
  function doLogout(){
    // Thorough cleanup so the next login starts from a clean slate.
    localStorage.removeItem('uno_token');
    localStorage.removeItem('uno_user');
    S.token=null; S.user=null; S.roomId=null; S.isSpectator=false;
    try{ S.socket?.disconnect(); }catch(e){}
    S.socket=null;
    clearInterval(S.roomsTimer); S.roomsTimer=null;
    clearInterval(S.railTimer); S.railTimer=null;
    // Tear down any modals / overlays still hanging around.
    ['profileOv','lbOv','rankedLbOv','tournOv','adminOv','coinsModal','mmov','winov','matchInvite','inviteToast','jbcOv','leagueOv','jBC']
      .forEach(id=>document.getElementById(id)?.classList.remove('show'));
    ['gameCenter','arena-setup','avatarPicker','langPicker','bet-picker'].forEach(id=>document.getElementById(id)?.remove());
    document.getElementById('lobbyMenu')?.classList.remove('show');
    document.getElementById('gameMenu')?.classList.remove('show');
    // Reset the auth screen tabs to login by default.
    document.getElementById('forgotForm')?.style && (document.getElementById('forgotForm').style.display='none');
    document.getElementById('authMain')?.style && (document.getElementById('authMain').style.display='block');
    if(typeof switchTab==='function') switchTab('login');
    document.getElementById('aerr') && (document.getElementById('aerr').textContent='');
    showScreen('auth-screen');
  }
  function setErr(m){document.getElementById('aerr').textContent=m;}

  /* ═══ SOCKET ═══ */
  function initSock(){
    if(S.socket?.connected)return;
    S.socket=io(SOCK,{auth:{token:S.token},reconnectionAttempts:10,reconnectionDelay:1500});
    const sk=S.socket;

    sk.on('connect',()=>{document.getElementById('dbar').classList.remove('show');if(S.roomId)sk.emit('room:join',{roomId:S.roomId});});
    sk.on('disconnect',()=>document.getElementById('dbar').classList.add('show'));
    initChatListeners(sk);

    sk.on('game:spectator_state',(state)=>{
      S.isSpectator = true;
      document.body.classList.add('spectating');
      Clutch.reset();
      // Reveal Watchers tab for spectators (and players-with-toggle)
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
      showScreen('game-screen');
      addActivityMsg('👁️ You are spectating','game');
    });
    sk.on('game:spectator_state_update',(state)=>{
      if(!S.isSpectator) return;
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
    });
    sk.on('league:round_ended', ({ round, winnerSlotId, nextRoundIn })=>{
      const ov = document.getElementById('roundIntermission');
      if (!ov) return;
      const title = document.getElementById('riTitle');
      const score = document.getElementById('riScore');
      const nextEl = document.getElementById('riNext');
      if (title) title.textContent = `ROUND ${round} DONE`;
      // Try to label the round-1 winner so it doesn't feel ambiguous
      const myName = S.user?.username || 'You';
      if (score) {
        const players = S.g?.players || [];
        const winnerPlayer = players.find(p => p.id === winnerSlotId) || null;
        if (winnerSlotId === 'draw') score.textContent = '🤝 Round drawn';
        else if (winnerPlayer) score.textContent = `🏁 ${winnerPlayer.username || 'Unknown'} won round ${round}`;
        else score.textContent = `🏁 Round ${round} done`;
      }
      const secs = Math.max(1, Math.round((nextRoundIn || 4500) / 1000));
      if (nextEl) nextEl.textContent = `Round 2 starting in ${secs}s…`;
      ov.classList.add('show');
      // Live countdown
      let left = secs;
      const t = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(t); return; }
        if (nextEl) nextEl.textContent = `Round 2 starting in ${left}s…`;
      }, 1000);
    });
    sk.on('league:round_started', ({ round })=>{
      const ov = document.getElementById('roundIntermission');
      if (ov) ov.classList.remove('show');
      const badge = document.getElementById('roundBadge');
      if (badge) badge.textContent = `ROUND ${round} / 2`;
      toast(`🔔 Round ${round} started`, 'i');
    });

    sk.on('vote:tally',({tally,my})=>{
      S.g.voteTally = tally || {};
      if(my !== undefined) S.g.myVote = my;
      if(S.isSpectator && S.g.players?.length) renderSpectatorOpps(S.g.players);
    });
    sk.on('chat:spectator_history',({messages})=>{
      const box=document.getElementById('specMsgs');
      if(box){box.innerHTML=''; (messages||[]).forEach(m=>addSpectatorMsg(m));}
    });
    sk.on('chat:spectator_message',(msg)=>{
      addSpectatorMsg(msg);
      // For non-spectator players, surface the watchers tab so they can peek
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
    });
    sk.on('room:spectator_joined',({username,count})=>{
      addActivityMsg(`👁️ ${esc(username||'A watcher')} is now watching (${count} total)`,'join');
    });
    sk.on('room:spectator_left',({count})=>{
      addActivityMsg(`👁️ A watcher left (${count} watching)`,'leave');
    });

    sk.on('game:state',(state)=>{
      // Reset start-button guard so future restarts work
      const startBtn=document.getElementById('bstart');
      if(startBtn){startBtn.dataset.starting='';startBtn.disabled=true;startBtn.textContent='Waiting for players...';}
      S.isSpectator=false;
      document.body.classList.remove('spectating');
      Clutch.reset();
      S.calledUNO=false;applyFullState(state);showScreen('game-screen');
      toast('Game started! 🎮','s');SFX.play('turn');
      showChatFab(true);addActivityMsg('🎮 Game has started!','game');
      initGameParticles();
      // Deal animation: cards fly from center to each player
      setTimeout(()=>{
        const handSize = state.myHand?.length || 7;
        const handEl = document.getElementById('myhand');
        const deckEl = document.getElementById('drawpile');
        if(handEl) AnimLayer.deal(handSize, handEl);
        // Opponents
        (state.players||[]).forEach((p,idx)=>{
          if(p.id===S.user?.id) return;
          setTimeout(()=>{
            const panel = document.querySelector(`.opanel[data-pid="${p.id}"]`);
            if(panel && deckEl) AnimLayer.drawMany(p.handSize||7, deckEl, panel, {stagger:75,duration:520});
          }, idx*200);
        });
      }, 200);
    });
    sk.on('game:state_update',(state)=>{if(!S.roomId)return;applyFullState(state);});
    sk.on('practice:error',({reason}={})=>{
      S.roomId=null;
      if(!document.getElementById('game-screen').classList.contains('active')){
        toast('⚠️ '+(reason||'Training could not start — try again'),'e');
      }
    });
    sk.on('world:history',(msgs)=>{
      const box=document.getElementById('worldMsgs');
      if(box){ box.innerHTML=(msgs||[]).map(_worldMsgHTML).join(''); box.scrollTop=box.scrollHeight; }
    });
    sk.on('world:msg',(m)=>_appendWorldMsg(m));

    sk.on('game:card_played',(data)=>{
      if(!S.roomId)return; // Ignore stale events after leaving the game
      if(data.topCard)renderTop(data.topCard);
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      SFX.play('play');
      const who=(data.players||[]).find(p=>p.id===data.playerId);
      toast(`${who?.username||'?'} played ${fmtV(data.card?.value)}`,'i');
      if(data.players){const p=data.players.find(p=>p.id===data.playerId&&!isMe(p.id));if(p&&p.handSize===1&&!p.saidUno)showCatchButton(p.id);}
      // Animation: opponent card flies to pile
      if(data.playerId !== S.user?.id){
        const oppPanel = document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
        const pileEl   = document.getElementById('topCard');
        if(data.card) AnimLayer.opponentPlay(data.card, oppPanel, pileEl);
      }
    });

    sk.on('game:auto_played',(data)=>{
      if(!S.roomId)return;
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      const who=(data.players||[]).find(p=>p.id===data.playerId);
      const name=who?.username||'?';
      if(data.action==='played' && data.card){
        if(data.topCard)renderTop(data.topCard);
        SFX.play('play');
        toast(`🤖 ${name} (auto) played ${fmtV(data.card.value)}`,'i');
        if(data.playerId !== S.user?.id){
          const oppPanel = document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
          const pileEl   = document.getElementById('topCard');
          AnimLayer.opponentPlay(data.card, oppPanel, pileEl);
        }
      } else if(data.action==='drew'){
        SFX.play('draw');
        Voice.sayDraw(1);
        toast(`🤖 ${name} (auto) drew a card`,'i');
        if(data.playerId !== S.user?.id){
          const panel=document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
          const deck=document.getElementById('drawpile');
          if(panel) AnimLayer.drawMany(1, deck, panel, {stagger:0,duration:560});
        }
      } else if(data.action==='stack_taken'){
        SFX.play('draw');
        Voice.sayDraw(data.count||2);
        toast(`🤖 ${name} (auto) took ${data.count} stack cards`,'i');
        const target = data.playerId === S.user?.id
          ? document.getElementById('myhand')
          : document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
        const deck = document.getElementById('drawpile');
        if(target) AnimLayer.drawMany(data.count||2, deck, target, {stagger:120,duration:600});
      }
    });

    sk.on('turn:changed',(data)=>{
      if(!S.roomId)return;
      S.g.currentTurn=data.currentPlayerId;S.g.direction=data.direction;
      S.g.drawPileSize=data.drawPileSize;S.g.turnPhase=data.turnPhase||'must_play';
      S.g.drawnCardId=data.drawnCardId||null;S.g.stackDraw=data.stackDraw||0;
      if(data.topCard)renderTop(data.topCard);
      document.getElementById('dcnt').textContent=data.drawPileSize;
      document.getElementById('cancelArea').style.display='none';
      if(data.currentPlayerId===S.user?.id)SFX.play('turn');
      updateTurnUI();
    });

    sk.on('game:drew_card',({card,cards,canPlay,wasStack})=>{
      if(!S.roomId)return;
      SFX.play('draw');
      S._skipNextSync=true;
      setTimeout(()=>{S._skipNextSync=false;},2000);
      if(wasStack && Array.isArray(cards) && cards.length){
        Voice.sayDraw(cards.length);
        const deck=document.getElementById('drawpile');
        const handEl=document.getElementById('myhand');
        AnimLayer.drawMany(cards.length, deck, handEl, {stagger:130,duration:600});
        for(const c of cards){
          if(!S.g.myHand.find(x=>x.id===c.id)) S.g.myHand.push(c);
        }
        S.g.drawnCardId=null;
      } else if(card){
        Voice.sayDraw(1);
        S.g.drawnCardId=card.id;
        if(!S.g.myHand.find(c=>c.id===card.id)){
          S.g.myHand.push(card);
          if(canPlay)S.g.myPlayable=[...new Set([...S.g.myPlayable,card.id])];
        }
      }
      S.g.turnPhase=canPlay?'drew_card':'waiting';
      renderHand();updateTurnUI();
      if(canPlay){document.getElementById('cancelArea').style.display='block';}
      else{document.getElementById('cancelArea').style.display='none';}
    });

    sk.on('game:player_drew',({playerId,count})=>{
      if(!S.roomId)return;
      const p=S.g.players.find(p=>p.id===playerId);
      Voice.sayDraw(count||1);
      if(p&&!isMe(p.id)){
        const panel=document.querySelector(`.opanel[data-pid="${playerId}"]`);
        const deck=document.getElementById('drawpile');
        if(panel){
          AnimLayer.drawMany(count||1, deck, panel, {stagger:120,duration:560});
          if((count||1) > 1){
            const fx=document.createElement('div');
            fx.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:900;color:#FFD700;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none;animation:popIn .4s ease forwards;z-index:20;';
            fx.textContent=`+${count}`;
            panel.appendChild(fx);
            setTimeout(()=>fx.remove(),1800);
          }
        }
      }
    });
    sk.on('game:color_chosen',({playerId,color})=>{document.getElementById('cmodal').classList.remove('show');const p=S.g.players.find(p=>p.id===playerId);toast(`${p?.username||'?'} chose ${color.toUpperCase()}!`,'i');const tc=document.getElementById('topcard');if(tc)tc.className=`ucard nohov ${color}`;});
    sk.on('game:direction_changed',({direction})=>{S.g.direction=direction;document.getElementById('hdir').textContent=direction===1?'↻ Clockwise':'↺ Counter-CW';});
    sk.on('game:uno_caught',({targetId,penaltyCards})=>{const p=S.g.players.find(p=>p.id===targetId);toast(`😱 ${p?.username||'?'} caught! +${penaltyCards} cards`,'e');removeCatch();});
    sk.on('game:player_won',(data)=>{showWin(data);SFX.play(data.winnerId===S.user?.id?'win':'error');});

    sk.on('matchmaking:matched',({roomId,players})=>{
      S.roomId=roomId;
      // Cinematic "match found" flash on the radar core, then enter the room
      const g=window.gsap, ov=document.getElementById('mmov');
      const finish=()=>{
        ov.classList.remove('show');
        if(g) g.set(ov,{clearProps:'opacity'});
        _resetLobbyCamera();
        toast('Match found!','s'); SFX.play('uno');
        showScreen('room-screen');
        if(players)renderWaiting(players);
        document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
      };
      if(g && ov.classList.contains('show') && !_mmReduced()){
        const core=ov.querySelector('.mm-core');
        if(core) g.fromTo(core,{scale:1},{scale:1.5,duration:.32,ease:'back.out(2)',yoyo:true,repeat:1});
        g.to(ov,{opacity:0,duration:.4,delay:.5,ease:'power2.in',onComplete:finish});
      } else { finish(); }
    });
  }

  /* ═══ STATE ═══ */
  function applyFullState(state){
    const g=S.g;
    if(state.players!==undefined)g.players=state.players;
    if(state.topCard!==undefined)g.topCard=state.topCard;
    if(state.currentTurn!==undefined)g.currentTurn=state.currentTurn;
    if(state.direction!==undefined)g.direction=state.direction;
    if(state.drawPileSize!==undefined)g.drawPileSize=state.drawPileSize;
    if(state.myHand!==undefined){
      if(S._skipNextSync){
      }else{
        g.myHand=state.myHand;
      }
    }
    if(state.myPlayable!==undefined)g.myPlayable=state.myPlayable;
    if(state.turnPhase!==undefined)g.turnPhase=state.turnPhase;
    if(state.drawnCardId!==undefined)g.drawnCardId=state.drawnCardId;
    if(state.stackDraw!==undefined)g.stackDraw=state.stackDraw||0;
    if(g.topCard)renderTop(g.topCard);
    renderOpps(g.players);renderHand();
    document.getElementById('dcnt').textContent=g.drawPileSize;
    document.getElementById('myname').textContent=S.user?.username||'You';
    document.getElementById('mycnt').textContent=g.myHand.length;
    if(g.turnPhase==='drew_card'&&isMe(g.currentTurn))document.getElementById('cancelArea').style.display='block';
    else document.getElementById('cancelArea').style.display='none';
    updateTurnUI();
  }

  // Spectator: render full game state with every player's hand visible
  function applySpectatorState(state){
    const g = S.g;
    g.players = state.players || [];
    g.topCard = state.topCard;
    g.currentTurn = state.currentTurn;
    g.direction = state.direction;
    g.drawPileSize = state.drawPileSize;
    g.turnPhase = state.turnPhase;
    g.stackDraw = state.stackDraw || 0;
    g.myHand = []; g.myPlayable = []; g.drawnCardId = null;
    g.spectatorHands = (state.hands || []).reduce((acc, h) => { acc[h.playerId] = h.cards; return acc; }, {});
    if (g.topCard) renderTop(g.topCard);
    renderSpectatorOpps(g.players);
    document.getElementById('dcnt').textContent = g.drawPileSize;
    document.getElementById('myhand').innerHTML = '';
    document.getElementById('cancelArea').style.display = 'none';
    document.getElementById('myname').textContent = '👁️ Spectating';
    document.getElementById('mycnt').textContent = `${g.players.length} players`;
    updateSpectatorTurnUI();
  }

  // Same opponent row, but every player is shown with face-up cards
  function renderSpectatorOpps(players){
    const row = document.getElementById('orow');
    if (!row) return;
    const tally = S.g.voteTally || {};
    const myVote = S.g.myVote || null;
    const newKey = players.map(p => `${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.id===S.g.currentTurn?1:0}:${tally[p.id]||0}:${myVote===p.id?'v':''}`).join('|') + '|spec';
    if (row._lastKey === newKey) return;
    row._lastKey = newKey;
    const hands = S.g.spectatorHands || {};
    row.innerHTML = players.map(p => {
      const cards = (hands[p.id] || []).slice(0, 12);
      const cardsHtml = cards.map((c,i) => {
        const color = c.chosenColor || c.color || 'wild';
        const v = fmtV(c.value);
        return `<div class="spec-card ${color}" style="margin-left:${i===0?'0':'-18px'};z-index:${i}">
          <span class="spec-card-num">${v}</span>
        </div>`;
      }).join('');
      const more = (hands[p.id]?.length || 0) > 12 ? `<div style="font-size:11px;color:rgba(255,255,255,.6);margin-left:6px;font-weight:700">+${hands[p.id].length - 12}</div>` : '';
      const avatar = _isImgAvatar(p.avatar)
        ? `<div class="opp-avatar" style="background-image:url('${p.avatar}')"></div>`
        : `<div class="opp-avatar opp-avatar-letter">${esc(p.avatar||(p.username||'?').charAt(0).toUpperCase())}</div>`;
      const votes = tally[p.id] || 0;
      const isMyVote = myVote === p.id;
      const voteBtn = `<button class="vote-btn ${isMyVote?'active':''}" onclick="voteFor('${p.id}')" title="${isMyVote?'Your pick':'Cheer for this player'}">${isMyVote?'⭐':'🗳️'} ${isMyVote?'Voted':'Vote'}</button>`;
      const voteCount = votes > 0 ? `<div class="vote-count">${votes} vote${votes===1?'':'s'}</div>` : '';
      return `<div class="opanel ${p.id===S.g.currentTurn?'myturn':''}" data-pid="${p.id}">
        <div class="oname-row">${avatar}<div class="oname" style="color:${p.id===S.g.currentTurn?'var(--accent)':'var(--text)'}">${esc(p.username)} ${p.saidUno?'<span class="ouno">UNO!</span>':''}</div></div>
        <div style="display:flex;align-items:center;height:64px">${cardsHtml}${more}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">${voteBtn}${voteCount}</div>
      </div>`;
    }).join('');
  }
  function voteFor(playerId){
    if(!S.isSpectator) return;
    if(!S.socket?.connected) return;
    S.socket.emit('vote:spectator',{playerId},(res)=>{
      if(!res?.success) toast(res?.reason||'Vote failed','e');
    });
  }
  function comingSoon(title, body){
    toast(`🚧 ${title} — ${body}`,'i');
  }

  /* ═══ LEAGUE HUB ═══ */
  const League = { data: null, liga: null, tab: 'liga' };
  async function showLeague(){
    const ov = document.getElementById('leagueOv');
    ov.classList.add('show');
    document.getElementById('leagueList').innerHTML =
      `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading...</div>`;
    try {
      const [elo, liga] = await Promise.all([
        api('GET','/competitions/me'),
        api('GET','/league/me'),
      ]);
      League.data = elo;
      League.liga = liga;
      renderLeagueHero(elo);
      switchLeagueTab(League.tab || 'liga');
    } catch(e) {
      document.getElementById('leagueList').innerHTML =
        `<div style="color:rgba(255,255,255,.7);text-align:center;padding:30px;font-weight:700">Could not load league data</div>`;
    }
  }
  function leagueIcon(name){
    return ({Bronze:'🥉',Silver:'🥈',Gold:'🥇',Diamond:'💎'})[name] || '🥉';
  }
  function renderLeagueHero(d){
    const me = d.me, league = me.league || {};
    document.getElementById('leagueHeroBadge').textContent = leagueIcon(league.name);
    document.getElementById('leagueHeroName').textContent = league.name || 'Bronze';
    document.getElementById('leagueHeroRank').textContent =
      `Rank #${me.rank} of ${d.totalPlayers} • ${me.gamesWon}/${me.gamesPlayed} wins`;
    document.getElementById('leagueHeroElo').textContent = `⚡ ${me.elo} ELO`;
    const bar = document.getElementById('leagueHeroBar');
    const lbl = document.getElementById('leagueHeroBarLbl');
    if (me.nextLeague) {
      bar.style.width = me.progress + '%';
      lbl.textContent = `${me.elo} → ${me.nextLeague.min} for ${me.nextLeague.name} ${leagueIcon(me.nextLeague.name)}`;
    } else {
      bar.style.width = '100%';
      lbl.textContent = 'Top league reached — keep winning to stay on top!';
    }
  }
  function switchLeagueTab(tab){
    League.tab = tab;
    document.getElementById('leagueTabLiga').classList.toggle('on', tab==='liga');
    document.getElementById('leagueTabProg').classList.toggle('on', tab==='programme');
    document.getElementById('leagueTabTop').classList.toggle('on', tab==='top');
    document.getElementById('leagueTabHist').classList.toggle('on', tab==='history');
    const list = document.getElementById('leagueList');
    if (tab === 'liga') return renderLigaTable(list);
    if (tab === 'programme') return renderLigaProgramme(list);
    if (!League.data) return;
    if (tab === 'history') {
      const hist = League.data.matchHistory || [];
      if (!hist.length) { list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">No matches yet — go play!</div>`; return; }
      list.innerHTML = hist.map(m => {
        const when = timeAgo(m.at);
        const opp = (m.opponents || []).map(esc).join(', ') || '?';
        const sign = m.eloChange > 0 ? '+' : '';
        return `<div class="match-row ${m.won?'win':'loss'}">
          <div class="match-result ${m.won?'win':'loss'}">${m.won?'WIN':'LOSS'}</div>
          <div class="match-vs">vs ${opp}</div>
          <div style="text-align:right">
            <div class="match-elo ${m.won?'win':'loss'}">${sign}${m.eloChange||0} ELO</div>
            <div class="match-when">${when}</div>
          </div>
        </div>`;
      }).join('');
    } else {
      const rows = tab === 'top' ? (League.data.top || []) : (League.data.neighbours || []);
      list.innerHTML = rows.map(u => {
        const isMe = u.id === S.user?.id;
        const posClass = u.rank === 1 ? 'gold' : u.rank === 2 ? 'silver' : u.rank === 3 ? 'bronze' : '';
        const av = _isImgAvatar(u.avatar)
          ? `<div class="league-mini-avatar" style="background-image:url('${u.avatar}')"></div>`
          : `<div class="league-mini-avatar">${esc(u.avatar||(u.username||'?').charAt(0).toUpperCase())}</div>`;
        const winRate = u.gamesPlayed > 0 ? Math.round((u.gamesWon / u.gamesPlayed) * 100) : 0;
        return `<div class="league-row ${isMe?'me':''}">
          <div class="league-pos ${posClass}">#${u.rank}</div>
          ${av}
          <div style="flex:1;min-width:0">
            <div class="league-row-name">${esc(u.username)}${isMe?' <span style="font-size:9px;color:#FFD700">(You)</span>':''}</div>
            <div class="league-row-meta">${u.gamesWon}W · ${u.gamesPlayed-u.gamesWon}L · ${winRate}%</div>
          </div>
          <div class="league-row-elo">${u.elo}</div>
        </div>`;
      }).join('');
    }
  }
  function renderLigaTable(list){
    if (!League.liga) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading…</div>`;
      return;
    }
    const liga = League.liga;
    const standings = liga.standings || [];
    const seasonHeader = renderLigaSeasonBar();
    const podiumBlock = renderLigaPodiumBlock();
    const rows = standings.map(p => {
      const posClass = p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : '';
      const zoneClass = p.zone === 'champions' ? 'liga-zone-champs'
                      : p.zone === 'europa'    ? 'liga-zone-europa'
                      : p.zone === 'relegation' ? 'liga-zone-relegate' : '';
      const av = p.isMe
        ? `<div class="liga-mini-av me">${(p.name||'?').charAt(0).toUpperCase()}</div>`
        : `<div class="liga-mini-av">${(p.name||'?').charAt(0).toUpperCase()}</div>`;
      const last5 = (p.last5 || []).map(r =>
        `<span class="last5-dot ${r}">${r==='W'?'W':r==='L'?'L':'D'}</span>`
      ).join('');
      const gd = p.goalDifference;
      const gdStr = gd > 0 ? '+'+gd : (gd < 0 ? gd : '0');
      const gdClass = gd > 0 ? 'pos' : gd < 0 ? 'neg' : 'zero';
      const youTag = p.isMe ? '<span class="liga-you-tag">YOU</span>' : '';
      const botTag = p.isBot ? '<span class="liga-bot-tag">BOT</span>' : '';
      return `<tr class="${p.isMe?'me':''} ${zoneClass}">
        <td><span class="liga-pos ${posClass}">${p.rank}</span></td>
        <td><div class="liga-name-cell">${av}<span class="liga-name">${esc(p.name)}${youTag}${botTag}</span></div></td>
        <td class="pts">${p.points}</td>
        <td class="col-mp">${p.played}</td>
        <td class="col-w">${p.wins}</td>
        <td class="col-l">${p.losses}</td>
        <td class="col-d">${p.draws}</td>
        <td class="col-gf">${p.goalsFor}</td>
        <td class="col-ga">${p.goalsAgainst}</td>
        <td class="col-gd ${gdClass}">${gdStr}</td>
        <td class="col-last5"><div class="last5-cell">${last5||'<span style="color:rgba(255,255,255,.25)">—</span>'}</div></td>
      </tr>`;
    }).join('');
    list.innerHTML = `${seasonHeader}${podiumBlock}<div class="liga-table-wrap"><table class="liga-table">
      <thead><tr>
        <th>#</th><th>Team</th>
        <th class="col-pts">PTS</th>
        <th class="col-mp">MP</th>
        <th class="col-w">W</th>
        <th class="col-l">L</th>
        <th class="col-d">D</th>
        <th class="col-gf">GF</th>
        <th class="col-ga">GA</th>
        <th>GD</th>
        <th class="col-last5">Last 5</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="liga-zone-legend">
      <span><i style="background:#2563EB"></i> Champions League (1-4)</span>
      <span><i style="background:#F59E0B"></i> Dawri Abtal (5-8)</span>
      <span><i style="background:#E8324A"></i> Relegation (10-14)</span>
    </div>`;
  }

  function renderLigaSeasonBar(){
    const liga = League.liga;
    if (!liga) return '';
    const totalDays = liga.daysPerSeason || 13;
    const fixturesPerDay = liga.fixturesPerDay || 2;
    let label, meta, pct;
    if (liga.finishedAt && liga.nextSeasonAt) {
      const left = Math.max(0, liga.nextSeasonAt - (liga.serverNow || Date.now()));
      const mins = Math.ceil(left / 60000);
      const human = mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
      label = `${liga.season || 'S1'} · Finished`;
      meta = `🏁 Next season in ${human}`;
      pct = 100;
    } else {
      const playedMax = Math.max(0, ...liga.standings.map(p => p.played));
      const dayNum = Math.min(totalDays, Math.ceil(playedMax / fixturesPerDay) || 1);
      const realUsers = liga.standings.filter(p => !p.isBot).length;
      label = `${liga.season || 'S1'} · Matchday ${dayNum}/${totalDays}`;
      meta = `${realUsers}/${liga.totalPlayers} real players · best-of-2 rounds`;
      pct = Math.min(100, Math.round((dayNum / totalDays) * 100));
    }
    return `<div class="liga-season-bar">
      <div class="liga-season-trophy">🏆</div>
      <div class="liga-season-text">
        <div class="liga-season-num">${label}</div>
        <div class="liga-season-meta">${meta}</div>
      </div>
      <div class="liga-season-progress" title="Season progress"><div class="liga-season-progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  }

  function renderLigaPodiumBlock(){
    const liga = League.liga;
    const podium = liga?.podium || liga?.previousSeasonPodium;
    if (!podium || !podium.length) return '';
    const medals = ['🥇','🥈','🥉'];
    const rows = podium.map((p, i) => `
      <div class="liga-podium-row">
        <div class="liga-podium-medal">${medals[i]||''}</div>
        <div class="liga-podium-name">${esc(p.name)}${p.isMe?' <span style="font-size:9px;color:#FFD700">(You)</span>':''}</div>
        <div class="liga-podium-prize">+${(p.prize||0).toLocaleString()} 🪙</div>
      </div>
    `).join('');
    const banner = liga.finishedAt
      ? '🏆 SEASON FINISHED — PODIUM'
      : '🏆 PREVIOUS SEASON PODIUM';
    return `<div class="liga-podium">
      <div class="liga-podium-title">${banner}</div>
      ${rows}
    </div>`;
  }

  function renderLigaProgramme(list){
    if (!League.liga) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading…</div>`;
      return;
    }
    const matches = League.liga.myMatches || [];
    if (!matches.length) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">No fixtures yet</div>`;
      return;
    }
    const now = League.liga.serverNow || Date.now();
    const today = new Date(now); today.setHours(0,0,0,0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const yesterday = new Date(today.getTime() - 86400000);
    // Group by real calendar date (YYYY-MM-DD)
    const byDate = {};
    matches.forEach(m => {
      const d = new Date(m.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      (byDate[key] = byDate[key] || []).push(m);
    });
    const dateKeys = Object.keys(byDate).sort();
    const dateLabel = (key) => {
      const [y, mo, d] = key.split('-').map(Number);
      const dt = new Date(y, mo - 1, d);
      const sameDay = (a, b) => a.getTime() === b.getTime();
      let prefix = '';
      if (sameDay(dt, today))      prefix = 'TODAY · ';
      else if (sameDay(dt, tomorrow))  prefix = 'TOMORROW · ';
      else if (sameDay(dt, yesterday)) prefix = 'YESTERDAY · ';
      const weekday = dt.toLocaleDateString([], { weekday: 'long' });
      const dayNum  = dt.getDate();
      const month   = dt.toLocaleDateString([], { month: 'long' });
      const year    = dt.getFullYear();
      return `${prefix}${weekday}, ${dayNum} ${month} ${year}`;
    };
    list.innerHTML = dateKeys.map(key => {
      const dayMatches = byDate[key].sort((a,b)=>a.scheduledAt-b.scheduledAt);
      const rows = dayMatches.map(m => {
        const opp = m.opponent;
        const av = `<div class="liga-mini-av">${(opp?.name||'?').charAt(0).toUpperCase()}</div>`;
        const date = new Date(m.scheduledAt);
        const timeStr = date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        let resultBadge = '';
        let action = '';
        if (m.status === 'finished') {
          const cls = m.result === 'W' ? 'win' : m.result === 'L' ? 'loss' : 'draw';
          const label = m.result === 'W' ? 'WIN' : m.result === 'L' ? 'LOSS' : 'DRAW';
          resultBadge = `<span class="programme-result ${cls}">${label} ${m.score||''}</span>`;
        } else if (m.status === 'live') {
          resultBadge = `<span class="programme-result live">🔴 LIVE</span>`;
        } else if (m.playable) {
          action = `<button class="btn-play-match" onclick="startLeagueMatch('${m.id}')">▶ Play Now</button>`;
        } else if (m.upcoming) {
          const mins = Math.ceil(m.startsIn / 60000);
          let hint;
          if (mins < 60) hint = mins + 'm';
          else if (mins < 60*24) hint = Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
          else hint = Math.floor(mins/(60*24)) + 'd ' + Math.floor((mins%(60*24))/60) + 'h';
          action = `<span class="programme-result" style="background:rgba(124,58,237,.18);color:#c4b5fd">⏳ in ${hint}</span>`;
        }
        return `<div class="programme-row ${m.status}">
          <div class="programme-time">${timeStr}</div>
          <div class="programme-vs">${av}<span>${esc(opp?.name||'?')}${opp?.isBot?' 🤖':''}</span></div>
          ${resultBadge || action}
        </div>`;
      }).join('');
      return `<div class="programme-day">📅 ${dateLabel(key)}</div>${rows}`;
    }).join('');
  }
  async function startLeagueMatch(matchId){
    try {
      const d = await api('POST','/league/match/'+matchId+'/start');
      toast(`Match started vs ${d.opponent}!`,'s');
      document.getElementById('leagueOv').classList.remove('show');
      document.body.classList.add('in-league-game');
      const badge = document.getElementById('roundBadge');
      if (badge) badge.textContent = 'ROUND 1 / 2';
      doJoin(d.roomId);
    } catch(e) {
      toast(e.message || 'Could not start match','e');
    }
  }
  function timeAgo(ts){
    const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  function updateSpectatorTurnUI(){
    const g = S.g;
    const stackEl = document.getElementById('hstack'), stackN = document.getElementById('hstackn');
    if ((g.stackDraw || 0) > 0) { stackEl.style.display='flex'; stackN.textContent = g.stackDraw + ' cards!'; }
    else stackEl.style.display = 'none';
    const cur = g.players.find(p => p.id === g.currentTurn);
    document.getElementById('tdisp').textContent = `🎬 ${cur?.username || '...'}'s turn`;
    document.getElementById('tdisp').className = 'turndisp';
    document.getElementById('hturn').textContent = `🎬 ${cur?.username || '...'}`;
    document.getElementById('hdir').textContent = g.direction === 1 ? '↻ Clockwise' : '↺ Counter-CW';
    document.getElementById('hphase').textContent = `👁️ Spectating`;
    // Hide the UNO button — spectators can't call UNO
    const u = document.getElementById('btnUNO'); if (u) u.classList.add('disabled');
  }

  function updateTurnUI(){
    const g=S.g;
    const stackEl=document.getElementById('hstack'),stackN=document.getElementById('hstackn');
    if((g.stackDraw||0)>0){stackEl.style.display='flex';stackN.textContent=(g.stackDraw)+' cards!';}
    else stackEl.style.display='none';
    const me=myTurn(),el=document.getElementById('tdisp'),ht=document.getElementById('hturn');
    if(me){el.textContent='⚡ YOUR TURN!';el.className='turndisp me';ht.textContent='⚡ Your Turn';}
    else{const p=g.players.find(p=>p.id===g.currentTurn);el.textContent=`${p?.username||'...'}\'s turn`;el.className='turndisp';ht.textContent=`⏳ ${p?.username||'...'}`;document.getElementById('cancelArea').style.display='none';}
    document.getElementById('hdir').textContent=g.direction===1?'↻ Clockwise':'↺ Counter-CW';
    document.getElementById('hphase').textContent=`🃏 ${g.myHand.length} cards`;
    updateUNOButton();
  }

  /* ═══ RENDER ═══ */
  function renderOpps(players){
    S.g.players=players;
    const row=document.getElementById('orow'),others=players.filter(p=>!isMe(p.id));
    const showMute = VoiceChat.isOn && players.length >= 3;
    const newKey=others.map(p=>`${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.isConnected?1:0}:${p.id===S.g.currentTurn?1:0}:${p.avatar?'a':'n'}:${showMute?(VoiceChat.mutedPeers?.has(p.id)?'m':'u'):'-'}`).join('|');
    if(row._lastKey===newKey) return;
    row._lastKey=newKey;
    row.innerHTML=others.map(p=>{
      const max=Math.min(p.handSize,10);
      const cards=Array.from({length:max},(_,i)=>`
        <div style="width:44px;height:66px;border-radius:8px;
          background:linear-gradient(145deg,#E8324A 50%,#1A1D2E 50%);
          border:2px solid rgba(255,255,255,.25);
          display:inline-flex;align-items:center;justify-content:center;
          margin-left:${i===0?'0':'-22px'};position:relative;z-index:${i};
          box-shadow:3px 4px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.15);
          flex-shrink:0;overflow:hidden;
          transform:perspective(300px) rotateY(${-8+i*2}deg) rotateX(3deg);
          transition:transform .3s ease;">
          <div style="font-family:'Bangers',cursive;font-size:9px;color:rgba(255,255,255,.35);transform:rotate(-15deg);text-shadow:0 1px 2px rgba(0,0,0,.5)">UNO</div>
        </div>`).join('');
      const avatar = _isImgAvatar(p.avatar)
        ? `<div class="opp-avatar" style="background-image:url('${p.avatar}')"></div>`
        : `<div class="opp-avatar opp-avatar-letter">${esc(p.avatar||(p.username||'?').charAt(0).toUpperCase())}</div>`;
      const isMuted = VoiceChat.mutedPeers?.has(p.id);
      const muteBtn = showMute
        ? `<button class="mute-toggle ${isMuted?'muted':''}" onclick="VoiceChat.toggleMutePeer('${p.id}')" title="${isMuted?'Unmute':'Mute'} ${esc(p.username)}'s mic">${isMuted?'🔇':'🔊'}</button>`
        : '';
      return`<div class="opanel ${p.id===S.g.currentTurn?'myturn':''}" data-pid="${p.id}">
          ${muteBtn}
          <div class="oname-row">${avatar}<div class="oname" style="color:${p.id===S.g.currentTurn?'var(--accent)':'var(--text)'}">${esc(p.username)}${p.saidUno?'<span class="ouno">UNO!</span>':''}</div></div>
          <div style="display:flex;align-items:center;height:70px;min-width:${Math.min(max*20+44,190)}px">${cards}${p.handSize>10?`<div style="font-size:11px;color:var(--muted);margin-left:6px;font-weight:700">+${p.handSize-10}</div>`:''}</div>
          ${!p.isConnected?'<div style="font-size:9px;color:var(--red);margin-top:2px">⚠ Offline</div>':''}
        </div>`;
    }).join('');
  }

  function renderTop(card){
    if(!card)return;S.g.topCard=card;
    const el=document.getElementById('topcard'),color=card.chosenColor||card.color;
    el.className=`ucard nohov ${color} topcard-land`;el.innerHTML=buildCardHTML(color,card.value);
    setTimeout(()=>el.classList.remove('topcard-land'),350);
  }

  function renderHand(){
    const g=S.g,playable=new Set(g.myPlayable),can=canIPlay(),c=document.getElementById('myhand');
    document.getElementById('mycnt').textContent=g.myHand.length;
    // Only re-render if hand actually changed
    const newKey = g.myHand.map(c=>c.id+(playable.has(c.id)?'p':'')).join(',')+'|'+g.turnPhase+'|'+g.currentTurn;
    if(c._lastKey === newKey) return;
    c._lastKey = newKey;
    c.innerHTML=g.myHand.map((card,i)=>{
      const color=card.chosenColor||card.color,ok=playable.has(card.id)&&can;
      const isDrawn=card.id===g.drawnCardId;
      return`<div class="hcard ${color} ${ok?'play':''} ${isDrawn?'drawn':''}"
        style="z-index:${i+1}${isDrawn?';box-shadow:0 0 20px var(--glow-yellow)':''}"
        onclick="${ok?`playCard('${card.id}')`:''}"
        title="${card.color} ${card.value}">
        ${buildCardHTML(color,card.value)}
      </div>`;
    }).join('');
  }

  function updateUNOButton(){
    const btn=document.getElementById('btnUNO');
    if(!btn)return;
    if(S.g.myHand.length===1&&!S.calledUNO&&myTurn()){btn.classList.remove('disabled');}
    else{btn.classList.add('disabled');if(S.g.myHand.length!==1)S.calledUNO=false;}
  }

  /* ═══ LOBBY ═══ */
  function goLobby(){
    // Reset spectator + clutch + league-game state when returning to lobby
    document.body.classList.remove('spectating','clutch','in-league-game');
    EVENT.exitRoomAmbiance();   // drop event-room vignette/particles
    document.getElementById('roundIntermission')?.classList.remove('show');
    S.isSpectator = false;
    S.g.spectatorHands = {};
    S.g.voteTally = {};
    S.g.myVote = null;
    Clutch.reset();
    const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='none';
    const sm=document.getElementById('specMsgs'); if(sm) sm.innerHTML='';
    if(Chat.activeTab==='spec') switchChatTab('chat');
    showScreen('lobby-screen');
    buildLobby3D(); initLobbyFx();
    if(S.user){
      document.getElementById('huser').textContent=S.user.username;
      _animateCount('hcoins',S.user.coins||0);
      _animateCount('scoins',S.user.coins||0);
    }
    renderLobbyHero();
    playLobbyIntro();
    requestAnimationFrame(_initLnav);   // align the floating-dock pill with the active tab
    loadRooms();loadRailFriends();
    EVENT.load();   // refresh the seasonal event overlay (banner, props, intro)
    clearInterval(S.roomsTimer);S.roomsTimer=setInterval(loadRooms,5000);
    clearInterval(S.railTimer);S.railTimer=setInterval(loadRailFriends,20000);
  }
  function renderLobbyHero(){
    const u=S.user; if(!u) return;
    _renderAvatarInto(document.getElementById('heroAvatar'), u);
    const nm=document.getElementById('heroName'); if(nm) nm.textContent=u.username||'Player';
    const lg=u.league||{};
    const lgEl=document.getElementById('heroLeague'); if(lgEl) lgEl.textContent=`${lg.badge||'🎖️'} ${lg.name||'Bronze'}`;
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0;
    _animateCount('heroCoins',u.coins||0);
    _animateCount('heroElo',u.elo??1000);
    _animateCount('heroWins',gw);
    const wrEl=document.getElementById('heroWinRate'); if(wrEl) wrEl.textContent=(gp?Math.round(gw/gp*100):0)+'%';
  }
  async function loadRooms(){
    try{
      const d=await api('GET','/rooms'),g=document.getElementById('rgrid');
      {
        const on=d.onlineCount||0;
        document.getElementById('rinfo').innerHTML=
          `${d.rooms.length} room${d.rooms.length===1?'':'s'} available `+
          `<span class="online-pill"><span class="online-dot"></span>${on} online</span>`;
      }
      // Render live games (spectatable)
      const live = d.liveGames || [];
      const liveSec = document.getElementById('liveSection');
      const liveGrid = document.getElementById('livegrid');
      const liveInfo = document.getElementById('liveinfo');
      if(liveSec && liveGrid){
        if(live.length){
          liveSec.style.display='';
          liveInfo.textContent = `${live.length} live game${live.length===1?'':'s'} — watch in progress`;
          liveGrid.innerHTML = live.map(r => _roomTableHTML(r, true, null)).join('');
        } else {
          liveSec.style.display='none';
        }
      }
      if(!d.rooms.length){g.innerHTML=`<div class="rooms-empty">
        <div class="rooms-empty-cards">
          <div class="ec red"><span>1</span></div>
          <div class="ec yellow"><span>+2</span></div>
          <div class="ec blue"><span>↺</span></div>
        </div>
        <div class="rooms-empty-title">No rooms yet</div>
        <div class="rooms-empty-sub">Create your own room or jump into a quick match — let's play! 🎮</div>
        <div class="rooms-empty-actions">
          <button class="ec-btn create" onclick="doCreate()">➕ Create Room</button>
          <button class="ec-btn match" onclick="doMM()">🎯 Quick Match</button>
        </div>
      </div>`;return;}
      const featId=EVENT.pickFeatured(d.rooms);
      g.innerHTML=d.rooms.map(r=>_roomTableHTML(r,false,featId)).join('');
      EVENT.decorateRooms();
    }catch(e){document.getElementById('rinfo').textContent='Could not load rooms';}
  }
  // ── Bottom navigation — premium floating dock ──
  // Slide the glowing pill behind the active tab (measured, so it works
  // with both content-width desktop tabs and equal-flex mobile tabs).
  function _moveLnavPill(el){
    const pill=document.getElementById('lnavPill');
    if(!pill||!el||!el.offsetWidth) return;
    pill.style.width=el.offsetWidth+'px';
    pill.style.transform='translateX('+el.offsetLeft+'px)';
  }
  function _initLnav(){
    const pill=document.getElementById('lnavPill');
    const on=document.querySelector('.lnav-tab.on')||document.querySelector('.lnav-tab');
    if(!pill||!on) return;
    pill.style.transition='none';          // no slide on first paint / resize
    _moveLnavPill(on);
    void pill.offsetWidth;
    pill.style.transition='';
  }
  function navTab(tab, el){
    document.querySelectorAll('.lnav-tab').forEach(t=>t.classList.remove('on'));
    if(el){
      el.classList.add('on');
      _moveLnavPill(el);
      const ic=el.querySelector('.lnav-ic');
      if(ic){ ic.classList.remove('pop'); void ic.offsetWidth; ic.classList.add('pop'); }
    }
    try{ SFX.play('click'); }catch(e){}
    if(tab==='home'){
      document.querySelector('.lmain')?.scrollTo({top:0,behavior:'smooth'});
    }
    else if(tab==='missions') showMissions();
    else if(tab==='collection') showCollection();
    else if(tab==='leaderboard') showLeaderboard();
    else if(tab==='profile') showProfile();
  }
  function _navModal(title, icon, bodyHTML, footHTML){
    const old=document.getElementById('navModal'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.id='navModal';
    ov.style.cssText='position:fixed;inset:0;z-index:1000;background:rgba(4,6,14,.84);'+
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);'+
      'display:flex;align-items:center;justify-content:center;padding:20px;animation:screenIn .25s ease';
    ov.innerHTML=`<div class="nm-panel">
      <div class="nm-head">
        <div class="nm-title">${icon} ${esc(title)}</div>
        <button class="nm-close" onclick="document.getElementById('navModal').remove()" aria-label="Close">×</button>
      </div>
      <div class="nm-body">${bodyHTML}${footHTML||''}</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }
  function showMissions(){
    const u=S.user||{};
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0, coins=u.coins||0, elo=u.elo||1000;
    const M=[
      {ic:'🎮',n:'Warm Up',     d:'Play 5 games',         cur:gp,   tgt:5,    rw:200},
      {ic:'🏆',n:'First Blood', d:'Win 3 games',          cur:gw,   tgt:3,    rw:300},
      {ic:'⚔️',n:'Competitor',  d:'Play 25 games',        cur:gp,   tgt:25,   rw:600},
      {ic:'🔥',n:'Hot Streak',  d:'Win 15 games',         cur:gw,   tgt:15,   rw:1000},
      {ic:'🪙',n:'Treasurer',   d:'Hold 5,000 coins',     cur:coins,tgt:5000, rw:500},
      {ic:'⚡',n:'Rising Star', d:'Reach 1,200 rating',   cur:elo,  tgt:1200, rw:800},
    ];
    const done=M.filter(m=>m.cur>=m.tgt).length;
    const body=`<div class="nm-grid">${M.map((m,i)=>{
      const ok=m.cur>=m.tgt, pct=Math.min(100,Math.round(m.cur/m.tgt*100));
      return `<div class="nm-mission ${ok?'done':''}" style="animation-delay:${i*55}ms">
        <div class="nm-mission-ic">${ok?'✅':m.ic}</div>
        <div class="nm-mission-main">
          <div class="nm-mission-name">${m.n}</div>
          <div class="nm-mission-desc">${m.d} · ${Math.min(m.cur,m.tgt).toLocaleString()}/${m.tgt.toLocaleString()}</div>
          <div class="nm-bar"><div class="nm-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="nm-mission-rw">${ok?'✓ DONE':'🪙 '+m.rw}</div>
      </div>`;
    }).join('')}</div>`;
    const foot=`<div style="text-align:center;font-size:12px;color:rgba(255,255,255,.5);font-weight:700;margin-top:14px">${done}/${M.length} missions complete — keep playing!</div>`;
    _navModal('Missions','🎯',body,foot);
  }
  function showCollection(){
    const cur=S.user?.avatar;
    const owned=(typeof AVATARS!=='undefined')?AVATARS:[];
    const body=`<div class="nm-coll">${owned.map((a,i)=>`
      <div class="nm-coll-item ${a.e===cur?'on':''}" style="animation-delay:${i*22}ms">
        <div class="nm-coll-face">${a.e}</div>
        <div class="nm-coll-name">${esc(a.n)}</div>
      </div>`).join('')}</div>`;
    const foot=`<div style="text-align:center;font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin-top:14px">${owned.length} characters unlocked · open Profile to equip one</div>`;
    _navModal('Collection','🃏',body,foot);
  }

  /* ═══════════════ BATTLE PASS ═══════════════ */
  const BP={ data:null };
  async function showBattlePass(){
    const old=document.getElementById('bpModal'); if(old) old.remove();
    _ensureBPStyles();
    const ov=document.createElement('div');
    ov.id='bpModal';
    ov.innerHTML=`<div class="bp-panel"><div class="bp-loading"><div class="bp-spin"></div>Loading Battle Pass…</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _bpClose(); });
    try{
      BP.data=await apiFetch('/api/battlepass');
      _renderBattlePass();
    }catch(e){
      const p=ov.querySelector('.bp-panel');
      if(p) p.innerHTML=`<div class="bp-loading" style="color:#f87171">Could not load Battle Pass</div>`;
    }
  }
  function _bpClose(){
    const ov=document.getElementById('bpModal'); if(!ov) return;
    ov.classList.add('out'); setTimeout(()=>ov.remove(),220);
  }
  function _bpCountdown(endsAt){
    const ms=endsAt-Date.now();
    if(ms<=0) return 'Season ended';
    const d=Math.floor(ms/86400000), h=Math.floor((ms%86400000)/3600000), m=Math.floor((ms%3600000)/60000);
    return d>0?`${d}d ${h}h left`:h>0?`${h}h ${m}m left`:`${m}m left`;
  }
  function _renderBattlePass(){
    const d=BP.data; if(!d) return;
    const ov=document.getElementById('bpModal'); if(!ov) return;
    const maxT=d.tiers.length;
    const lvl=d.level;
    const inLvl=lvl>=maxT?d.xpPerTier:(d.xp%d.xpPerTier);
    const pct=lvl>=maxT?100:Math.round(inLvl/d.xpPerTier*100);
    const claimed=new Set(d.claimed);
    const card=(tr,track,tier)=>{
      const rw=tr[track], key=`${tier}:${track}`, isClaimed=claimed.has(key);
      const unlocked=lvl>=tier;
      const canClaim=unlocked && !isClaimed && (track==='free'||d.premium);
      const state=isClaimed?'claimed':canClaim?'claimable':'locked';
      const badge=isClaimed?'✓':canClaim?'CLAIM':(track==='prem'&&!d.premium?'👑':'🔒');
      return `<div class="bp-rw ${track} r-${rw.rarity} ${state}" data-key="${key}" `+
        `${canClaim?`onclick="claimBP(${tier},'${track}')"`:''}>
        <div class="bp-rw-shine"></div>
        <div class="bp-rw-icon">${rw.icon}</div>
        <div class="bp-rw-amt">🪙 ${esc(rw.label)}</div>
        <div class="bp-rw-badge">${badge}</div>
      </div>`;
    };
    const cols=d.tiers.map((tr,i)=>{
      const tier=i+1, unlocked=lvl>=tier, current=tier===lvl+1;
      return `<div class="bp-col ${unlocked?'on':''} ${current?'current':''}">
        ${card(tr,'prem',tier)}
        <div class="bp-tier ${unlocked?'on':''}">${tier}</div>
        ${card(tr,'free',tier)}
      </div>`;
    }).join('');
    ov.querySelector('.bp-panel').innerHTML=`
      <div class="bp-aura"></div>
      <div class="bp-head">
        <div class="bp-season">
          <div class="bp-season-name">${esc(d.name)}</div>
          <div class="bp-season-timer">⏳ ${_bpCountdown(d.endsAt)}</div>
        </div>
        <div class="bp-lvlwrap">
          <div class="bp-lvl">${lvl}</div>
          <div class="bp-xp">
            <div class="bp-xp-top"><span>LEVEL ${lvl}</span><span>${lvl>=maxT?'MAX':inLvl+' / '+d.xpPerTier+' XP'}</span></div>
            <div class="bp-xp-bar"><div class="bp-xp-fill" style="width:0%"></div></div>
          </div>
        </div>
        <button class="bp-close" onclick="_bpClose()" aria-label="Close">×</button>
      </div>
      ${d.premium
        ? `<div class="bp-prem-on">👑 PREMIUM PASS ACTIVE — every tier unlocked</div>`
        : `<div class="bp-prem-cta">
             <div class="bp-prem-cta-txt"><b>👑 Unlock Premium Pass</b><span>Unlock the gold track — exclusive rewards every tier</span></div>
             <button class="bp-prem-btn" onclick="unlockBPPremium()">${d.premiumPrice.toLocaleString()} 🪙</button>
           </div>`}
      <div class="bp-tracklabels">
        <div class="bp-tl prem">👑 PREMIUM</div>
        <div class="bp-tl free">FREE</div>
      </div>
      <div class="bp-track" id="bpTrack">${cols}</div>`;
    // animate XP bar + cinematic intro
    const g=window.gsap, fill=ov.querySelector('.bp-xp-fill');
    if(g && !matchMedia('(prefers-reduced-motion:reduce)').matches){
      g.fromTo('.bp-panel',{y:40,opacity:0,scale:.96},{y:0,opacity:1,scale:1,duration:.5,ease:'back.out(1.4)'});
      g.to(fill,{width:pct+'%',duration:1.1,ease:'power2.out',delay:.25});
      g.fromTo('.bp-col',{y:30,opacity:0},{y:0,opacity:1,duration:.45,stagger:.04,ease:'power3.out',delay:.15});
      // scroll the track to the current tier
      setTimeout(()=>{
        const cur=ov.querySelector('.bp-col.current');
        if(cur) cur.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
      },500);
    } else {
      if(fill) fill.style.width=pct+'%';
      const cur=ov.querySelector('.bp-col.current');
      if(cur) cur.scrollIntoView({inline:'center',block:'nearest'});
    }
  }
  async function claimBP(tier,track){
    try{
      const d=await apiFetch('/api/battlepass/claim',{method:'POST',body:JSON.stringify({tier,track})});
      BP.data.claimed=d.claimed;
      if(typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        _animateCount('hcoins',d.coins);
      }
      _renderBattlePass();
      _claimCinematic(d.reward||{}, track);
    }catch(e){ toast(e.message||'Could not claim','e'); }
  }
  // Rarity-scaled claim reveal — common = clean pop, legendary = big cinematic.
  function _claimCinematic(reward, track){
    const g=window.gsap;
    const rar=reward.rarity||'common';
    const R=({
      common:   {c:'#B6BDCC',name:'COMMON',   parts:9,  rays:0,flash:0,shake:0,  build:.05},
      rare:     {c:'#3B82F6',name:'RARE',     parts:18, rays:1,flash:0,shake:0,  build:.22},
      epic:     {c:'#A855F7',name:'EPIC',     parts:30, rays:1,flash:1,shake:5,  build:.4},
      legendary:{c:'#F59E0B',name:'LEGENDARY',parts:50, rays:1,flash:1,shake:11, build:.65},
    })[rar]||{c:'#B6BDCC',name:'COMMON',parts:9,rays:0,flash:0,shake:0,build:.05};
    _ensureBPStyles();
    const ov=document.createElement('div');
    ov.id='claimCine';
    ov.style.setProperty('--cc',R.c);
    ov.innerHTML=`
      ${R.rays?'<div class="cc-rays"></div>':''}
      ${R.flash?'<div class="cc-flash"></div>':''}
      <div class="cc-card r-${rar}">
        <div class="cc-card-shine"></div>
        <div class="cc-rarity">${R.name}</div>
        <div class="cc-icon">${reward.icon||'🪙'}</div>
        <div class="cc-amount">+${(reward.amount||0).toLocaleString()} 🪙</div>
        <div class="cc-trk">${track==='prem'?'👑 PREMIUM REWARD':'FREE REWARD'}</div>
      </div>
      <div class="cc-tap">Tap to continue</div>`;
    document.body.appendChild(ov);
    const card=ov.querySelector('.cc-card');
    const done=()=>{ if(ov._x)return; ov._x=1;
      if(g) g.to(ov,{opacity:0,duration:.25,onComplete:()=>ov.remove()}); else ov.remove(); };
    ov.addEventListener('click',done);
    const bigSound=rar==='legendary'||rar==='epic';
    if(!g || matchMedia('(prefers-reduced-motion:reduce)').matches){
      try{SFX.play(bigSound?'win':'uno');}catch(e){}
      setTimeout(done,1700); return;
    }
    const tl=g.timeline();
    tl.fromTo(ov,{opacity:0},{opacity:1,duration:.22});
    if(ov.querySelector('.cc-rays'))
      tl.fromTo('.cc-rays',{scale:.25,opacity:0,rotation:-70},{scale:1,opacity:1,rotation:0,duration:.55+R.build,ease:'power2.out'},0);
    if(R.build) tl.to({},{duration:R.build});                       // anticipation
    if(ov.querySelector('.cc-flash'))
      tl.fromTo('.cc-flash',{opacity:0},{opacity:.85,duration:.1,yoyo:true,repeat:1},'>-.04');
    tl.fromTo(card,{scale:.2,rotationY:-180,opacity:0},
      {scale:1,rotationY:0,opacity:1,duration:.62,ease:'back.out(1.8)'},'>-.06')
      .call(()=>{ try{SFX.play(bigSound?'win':'uno');}catch(e){} _ccParticles(card,R); });
    if(R.shake)
      tl.fromTo(ov,{x:-R.shake},{x:R.shake,duration:.05,repeat:5,yoyo:true,ease:'none',clearProps:'x'},'<');
    tl.fromTo('.cc-card-shine',{x:'-170%'},{x:'280%',duration:.75,ease:'power1.inOut'},'>-.15')
      .fromTo('.cc-tap',{opacity:0},{opacity:1,duration:.4},'>-.1')
      .to(card,{y:-9,duration:1.7,ease:'sine.inOut',yoyo:true,repeat:-1},'>');
    setTimeout(done, bigSound?(rar==='legendary'?5400:4400):3400);
  }
  function _ccParticles(originEl,R){
    const g=window.gsap; if(!g) return;
    const r=originEl.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<R.parts;i++){
      const p=document.createElement('div');
      p.className='cc-particle';
      if(Math.random()<.5){ p.textContent='🪙'; }
      else { p.classList.add('dot'); p.style.background=R.c; p.style.boxShadow=`0 0 10px ${R.c}`; }
      p.style.left=cx+'px'; p.style.top=cy+'px';
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2, dist=110+Math.random()*300;
      g.to(p,{x:Math.cos(ang)*dist,y:Math.sin(ang)*dist-Math.random()*110,
        rotation:(Math.random()-.5)*660,scale:.4+Math.random()*1.25,
        duration:.95+Math.random()*.6,ease:'power3.out'});
      g.to(p,{opacity:0,duration:.5,delay:.6+Math.random()*.4,onComplete:()=>p.remove()});
    }
  }
  async function unlockBPPremium(){
    if(!confirm(`Unlock the Premium Battle Pass for ${BP.data.premiumPrice.toLocaleString()} coins?`)) return;
    try{
      const d=await apiFetch('/api/battlepass/unlock',{method:'POST',body:JSON.stringify({})});
      BP.data.premium=true;
      if(typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        _animateCount('hcoins',d.coins);
      }
      try{ SFX.play('win'); }catch(e){}
      _renderBattlePass();
      const ov=document.getElementById('bpModal');
      if(window.gsap&&ov) window.gsap.fromTo(ov.querySelectorAll('.bp-rw.prem'),
        {scale:.7,opacity:.3},{scale:1,opacity:1,duration:.5,stagger:.03,ease:'back.out(1.7)'});
      toast('👑 Premium Pass unlocked!','s');
    }catch(e){ toast(e.message||'Could not unlock','e'); }
  }
  function _ensureBPStyles(){
    if(document.getElementById('bp-styles')) return;
    const s=document.createElement('style'); s.id='bp-styles';
    s.textContent=`
      @keyframes bpIn{from{opacity:0}to{opacity:1}}
      @keyframes bpOut{to{opacity:0}}
      @keyframes bpSpin{to{transform:rotate(360deg)}}
      @keyframes bpClaimPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55),0 8px 22px rgba(0,0,0,.5)}50%{box-shadow:0 0 0 7px rgba(245,158,11,0),0 8px 22px rgba(0,0,0,.5)}}
      @keyframes bpShine{0%,55%{transform:translateX(-160%) skewX(-20deg)}100%{transform:translateX(360%) skewX(-20deg)}}
      @keyframes bpAura{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.8;transform:translate(-50%,-50%) scale(1.12)}}
      #bpModal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px;
        background:radial-gradient(ellipse at 50% 35%,rgba(40,22,8,.7),rgba(3,4,12,.97));
        backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);animation:bpIn .3s ease;}
      #bpModal.out{animation:bpOut .22s ease forwards;}
      .bp-panel{position:relative;width:min(940px,97vw);max-height:92vh;overflow:hidden;
        display:flex;flex-direction:column;
        background:linear-gradient(180deg,rgba(30,26,48,.98),rgba(14,12,26,.99));
        border:1px solid rgba(255,215,0,.18);border-radius:24px;
        box-shadow:0 50px 120px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06);}
      .bp-aura{position:absolute;left:50%;top:0;width:80%;height:300px;transform:translate(-50%,-50%);
        background:radial-gradient(ellipse,rgba(245,158,11,.3),transparent 70%);filter:blur(40px);
        pointer-events:none;animation:bpAura 6s ease-in-out infinite;}
      .bp-loading{padding:70px;text-align:center;color:rgba(255,255,255,.6);font-weight:700;
        display:flex;flex-direction:column;align-items:center;gap:14px;}
      .bp-spin{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#F59E0B;animation:bpSpin .8s linear infinite;}
      .bp-head{position:relative;z-index:1;display:flex;align-items:center;gap:18px;padding:20px 24px 14px;flex-wrap:wrap;}
      .bp-season-name{font-family:'Bangers',cursive;font-size:26px;letter-spacing:1.5px;
        background:linear-gradient(180deg,#FFF7E0,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .bp-season-timer{font-size:11px;font-weight:800;color:#FFB87A;letter-spacing:.5px;margin-top:2px;}
      .bp-lvlwrap{display:flex;align-items:center;gap:12px;margin-left:auto;}
      .bp-lvl{width:54px;height:54px;flex-shrink:0;border-radius:14px;display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:26px;color:#1a0e04;
        background:linear-gradient(135deg,#FFD700,#F59E0B);box-shadow:0 6px 18px rgba(245,158,11,.5),inset 0 1px 0 rgba(255,255,255,.5);}
      .bp-xp{width:210px;max-width:42vw;}
      .bp-xp-top{display:flex;justify-content:space-between;font-size:9.5px;font-weight:800;letter-spacing:.8px;color:rgba(255,255,255,.6);margin-bottom:5px;}
      .bp-xp-bar{height:10px;border-radius:8px;background:rgba(0,0,0,.4);overflow:hidden;border:1px solid rgba(255,255,255,.07);}
      .bp-xp-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#F59E0B,#FFD700);box-shadow:0 0 12px rgba(245,158,11,.6);}
      .bp-close{width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.75);
        font-family:inherit;transition:all .2s;}
      .bp-close:hover{background:rgba(232,50,74,.22);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg);}
      .bp-prem-cta{position:relative;z-index:1;display:flex;align-items:center;gap:14px;margin:4px 24px 6px;
        padding:12px 16px;border-radius:14px;
        background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(124,58,237,.12));
        border:1px solid rgba(245,158,11,.4);}
      .bp-prem-cta-txt{flex:1;display:flex;flex-direction:column;gap:2px;}
      .bp-prem-cta-txt b{font-size:14px;color:#fff;}
      .bp-prem-cta-txt span{font-size:11px;color:rgba(255,255,255,.6);font-weight:600;}
      .bp-prem-btn{padding:11px 20px;border:none;border-radius:11px;cursor:pointer;
        background:linear-gradient(135deg,#FFD700,#F59E0B);color:#1a0e04;
        font-family:'Outfit',sans-serif;font-size:13px;font-weight:900;letter-spacing:.5px;
        box-shadow:0 6px 18px rgba(245,158,11,.45);transition:all .2s cubic-bezier(.34,1.56,.64,1);}
      .bp-prem-btn:hover{transform:translateY(-2px) scale(1.04);filter:brightness(1.08);}
      .bp-prem-on{margin:4px 24px 6px;padding:10px;border-radius:12px;text-align:center;
        font-size:12px;font-weight:800;letter-spacing:.5px;color:#FFD700;
        background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);}
      .bp-tracklabels{display:flex;flex-direction:column;gap:74px;position:absolute;left:8px;top:128px;z-index:2;pointer-events:none;}
      .bp-tl{font-size:8px;font-weight:900;letter-spacing:1px;writing-mode:vertical-rl;transform:rotate(180deg);
        color:rgba(255,255,255,.3);}
      .bp-tl.prem{color:rgba(245,158,11,.6);}
      .bp-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:14px 24px 22px;
        scrollbar-width:thin;scrollbar-color:rgba(245,158,11,.4) transparent;}
      .bp-track::-webkit-scrollbar{height:7px;}
      .bp-track::-webkit-scrollbar-thumb{background:rgba(245,158,11,.4);border-radius:7px;}
      .bp-col{flex-shrink:0;width:94px;display:flex;flex-direction:column;align-items:center;gap:9px;}
      .bp-col.current .bp-tier{box-shadow:0 0 0 3px #FFD700,0 0 22px rgba(245,158,11,.7);transform:scale(1.12);}
      .bp-tier{position:relative;width:36px;height:36px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-family:'Bangers',cursive;font-size:18px;color:rgba(255,255,255,.5);
        background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.1);transition:all .3s;}
      .bp-tier.on{color:#1a0e04;background:linear-gradient(135deg,#FFD700,#F59E0B);border-color:transparent;}
      .bp-tier::before{content:'';position:absolute;right:100%;width:14px;height:4px;background:rgba(255,255,255,.08);}
      .bp-tier.on::before{background:linear-gradient(90deg,#F59E0B,#FFD700);}
      .bp-col:first-child .bp-tier::before{display:none;}
      .bp-rw{position:relative;width:88px;height:90px;border-radius:13px;cursor:default;overflow:hidden;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        background:linear-gradient(165deg,rgba(255,255,255,.06),rgba(0,0,0,.25));
        border:1.5px solid var(--rc,rgba(255,255,255,.12));
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}
      .bp-rw.r-common{--rc:#9CA3AF;}
      .bp-rw.r-rare{--rc:#3B82F6;}
      .bp-rw.r-epic{--rc:#A855F7;}
      .bp-rw.r-legendary{--rc:#F59E0B;}
      .bp-rw.prem{background:linear-gradient(165deg,color-mix(in srgb,var(--rc) 24%,rgba(40,28,6,.6)),rgba(20,12,4,.7));}
      .bp-rw-shine{position:absolute;top:0;left:0;width:42%;height:100%;pointer-events:none;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:translateX(-160%);}
      .bp-rw-icon{font-size:26px;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));}
      .bp-rw-amt{font-size:11px;font-weight:800;color:#fff;}
      .bp-rw-badge{font-size:9px;font-weight:900;letter-spacing:.6px;padding:2px 7px;border-radius:10px;
        background:rgba(0,0,0,.4);color:rgba(255,255,255,.55);}
      .bp-rw.locked{opacity:.5;}
      .bp-rw.claimed{opacity:.7;}
      .bp-rw.claimed{border-color:rgba(74,222,128,.5);}
      .bp-rw.claimed .bp-rw-badge{background:rgba(74,222,128,.2);color:#4ade80;}
      .bp-rw.claimable{cursor:pointer;border-color:var(--rc);
        box-shadow:0 0 18px color-mix(in srgb,var(--rc) 45%,transparent),0 8px 22px rgba(0,0,0,.5);
        animation:bpClaimPulse 1.8s ease-in-out infinite;}
      .bp-rw.claimable .bp-rw-badge{background:linear-gradient(135deg,#FFD700,#F59E0B);color:#1a0e04;}
      .bp-rw.claimable .bp-rw-shine{animation:bpShine 2.4s ease-in-out infinite;}
      .bp-rw.claimable:hover{transform:translateY(-5px) scale(1.06);}
      @media (max-width:560px){
        .bp-head{padding:16px 16px 10px;}.bp-xp{width:140px;}
        .bp-prem-cta,.bp-prem-on{margin-left:14px;margin-right:14px;}
        .bp-track{padding:14px 14px 20px;}.bp-tracklabels{display:none;}
      }
      /* ── Claim reward cinematic ── */
      @keyframes ccRaySpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
      #claimCine{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:18px;cursor:pointer;perspective:1100px;
        background:radial-gradient(ellipse at 50% 45%,rgba(20,14,4,.72),rgba(2,3,8,.93));
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
      .cc-rays{position:absolute;left:50%;top:48%;width:150vmax;height:150vmax;
        transform:translate(-50%,-50%);pointer-events:none;
        background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--cc) 38%,transparent) 0deg 9deg,transparent 9deg 22deg);
        -webkit-mask:radial-gradient(circle,#000 4%,transparent 52%);mask:radial-gradient(circle,#000 4%,transparent 52%);
        animation:ccRaySpin 14s linear infinite;}
      .cc-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#fff,transparent 55%);pointer-events:none;}
      .cc-card{position:relative;width:230px;padding:26px 20px 20px;border-radius:22px;
        transform-style:preserve-3d;text-align:center;overflow:hidden;
        background:linear-gradient(170deg,color-mix(in srgb,var(--cc) 30%,rgba(22,18,30,.96)),rgba(12,10,20,.98));
        border:2px solid var(--cc);
        box-shadow:0 0 60px color-mix(in srgb,var(--cc) 55%,transparent),0 30px 70px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.14);}
      .cc-card-shine{position:absolute;top:0;left:0;width:46%;height:100%;pointer-events:none;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-170%) skewX(-18deg);}
      .cc-rarity{font-family:'Bangers',cursive;font-size:15px;letter-spacing:3px;color:var(--cc);
        text-shadow:0 0 16px color-mix(in srgb,var(--cc) 70%,transparent);margin-bottom:8px;}
      .cc-icon{font-size:74px;line-height:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6));}
      .cc-amount{font-family:'Bangers',cursive;font-size:34px;letter-spacing:1px;margin-top:8px;
        background:linear-gradient(180deg,#FFF7E0,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .cc-trk{font-size:9.5px;font-weight:900;letter-spacing:1.4px;color:rgba(255,255,255,.6);margin-top:8px;}
      .cc-tap{font-size:11px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.5);text-transform:uppercase;}
      .cc-particle{position:fixed;font-size:24px;pointer-events:none;z-index:1101;will-change:transform;}
      .cc-particle.dot{width:9px;height:9px;border-radius:50%;font-size:0;}
    `;
    document.head.appendChild(s);
  }

  // ── Right rail: Friends Online + World Chat ──
  async function loadRailFriends(){
    const box=document.getElementById('railFriends');
    if(!box) return;
    try{
      const d=await apiFetch('/api/friends');
      const friends=(d.friends||[]).slice().sort((a,b)=>(b.isOnline?1:0)-(a.isOnline?1:0));
      const online=friends.filter(f=>f.isOnline).length;
      const nEl=document.getElementById('railFriendsN'); if(nEl) nEl.textContent=online;
      if(!friends.length){
        box.innerHTML=`<div class="rail-empty">No friends yet.<br>Add some with the 👥 button.</div>`;
        return;
      }
      box.innerHTML=friends.map(f=>{
        const img=_isImgAvatar(f.avatar);
        const face=img?'':esc(f.avatar||(f.username||'?').charAt(0).toUpperCase());
        return `<div class="rail-friend">
          <div class="rail-friend-av ${f.isOnline?'':'off'}" style="${img?`background-image:url('${f.avatar}')`:''}">${face}</div>
          <div class="rail-friend-info">
            <div class="rail-friend-name">${esc(f.username)}</div>
            <div class="rail-friend-status ${f.isOnline?'':'off'}">${f.isOnline?'● Online':'Offline'}</div>
          </div>
        </div>`;
      }).join('');
    }catch(e){
      box.innerHTML=`<div class="rail-empty">Couldn't load friends</div>`;
    }
  }
  function _worldMsgHTML(m){
    const me=m.userId===S.user?.id;
    return `<div class="rail-msg ${me?'me':''}"><span class="rail-msg-name">${esc(m.name||'?')}:</span> <span class="rail-msg-text">${esc(m.text||'')}</span></div>`;
  }
  function _appendWorldMsg(m){
    const box=document.getElementById('worldMsgs');
    if(!box) return;
    const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<48;
    box.insertAdjacentHTML('beforeend',_worldMsgHTML(m));
    while(box.children.length>60) box.removeChild(box.firstChild);
    if(atBottom) box.scrollTop=box.scrollHeight;
  }
  function sendWorld(){
    const inp=document.getElementById('worldInput');
    if(!inp) return;
    const txt=(inp.value||'').trim();
    if(!txt) return;
    if(!S.socket?.connected) return toast('Not connected','e');
    S.socket.emit('world:send',{text:txt});
    inp.value='';
  }

  // Render one room as a premium 3D table with seated players.
  const _FELTS=[['#15803D','#08351b'],['#B91C1C','#4a0a0a'],['#1D4ED8','#0a1f52'],['#9333EA','#3b0f63']];
  function _roomTableHTML(r, live, featId){
    const max=r.maxPlayers||4;
    const seats=r.seats||[];
    const f=live?['#B91C1C','#4a0a0a']:_FELTS[((r.id.charCodeAt(0)||0)+(r.id.charCodeAt(2)||0))%_FELTS.length];
    let seatHTML='';
    for(let i=0;i<max;i++){
      // seats ride a foreshortened ellipse around the 3D table
      const ang=(-90+360/max*i)*Math.PI/180;
      const x=(50+Math.cos(ang)*45).toFixed(1);
      const y=(42+Math.sin(ang)*23).toFixed(1);
      const df=(Math.sin(ang)+1)/2;                 // 0 = back row, 1 = front
      const sc=(0.78+df*0.36).toFixed(3);           // front seats larger (depth)
      const sz=2+Math.round(df*10);                 // front seats overlap back
      const p=seats[i];
      const st=`left:${x}%;top:${y}%;--s:${sc};--sz:${sz}`;
      if(p){
        const img=_isImgAvatar(p.avatar);
        const face=img?'':esc(p.avatar||(p.name||'?').charAt(0).toUpperCase());
        seatHTML+=`<div class="rt-seat filled" style="${st}" title="${esc(p.name||'')}">`+
          `<div class="rt-av" style="${img?`background-image:url('${p.avatar}')`:''};animation-delay:${i*70}ms">${face}</div></div>`;
      }else{
        seatHTML+=`<div class="rt-seat empty" style="${st}"></div>`;
      }
    }
    const code=r.id.substr(0,6).toUpperCase();
    // Seasonal event rooms — every room transforms while an event is live;
    // one rotating room is the spotlit "featured" room.
    const ev=EVENT.data;
    const isFeat=!!(ev&&featId&&r.id===featId&&!live);
    const evDeco=ev?(
      `<div class="rt-frame${isFeat?' feat':''}" aria-hidden="true"></div>`+
      `<div class="rt-ribbon">${ev.icon||'🎉'} LIMITED</div>`+
      (isFeat?`<div class="rt-feat-badge">⭐ FEATURED</div><div class="rt-ev-fx" data-evfx="1" aria-hidden="true"></div>`:'')
    ):'';
    const evCls=ev?' rt-event':'';
    const stage=`<div class="rtable-stage">
        <div class="rtable-felt"><div class="rtable-center"><div class="rtable-unocard">UNO</div></div></div>
        ${seatHTML}
        <div class="rt-energy" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </div>`;
    const active=(r.players>0||(seats&&seats.length>0))?' rt-active':'';
    if(live){
      return `<div class="rtable rt-active${evCls}" onclick="doWatch('${r.id}')" style="--felt:${f[0]};--felt2:${f[1]}">
        <div class="rtable-glow"></div>
        ${evDeco}
        <div class="rtable-top"><span class="rtable-name">🔴 LIVE MATCH</span><span class="rtable-tag" style="color:#fca5a5">▶ WATCH</span></div>
        ${stage}
        <div class="rtable-foot">
          <span class="rtable-count"><b>${r.players}</b>/${max}</span>
          <span class="rtable-entry" style="color:#93C5FD;background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.25)">👁️ ${r.spectators||0}</span>
          <span class="rtable-join" style="background:linear-gradient(135deg,#E8324A,#9B1B2E)">SPECTATE ▶</span>
        </div>
      </div>`;
    }
    return `<div class="rtable${active}${evCls}${isFeat?' rt-featured':''}" onclick="doJoin('${r.id}')" style="--felt:${f[0]};--felt2:${f[1]}">
      <div class="rtable-glow"></div>
      ${evDeco}
      <div class="rtable-top"><span class="rtable-name">ROOM #${code}</span><span class="rtable-tag">● OPEN</span></div>
      ${stage}
      <div class="rtable-foot">
        <span class="rtable-count"><b>${r.players}</b>/${max}</span>
        ${r.bet?`<span class="rtable-entry">🪙 ${r.bet.toLocaleString()}</span>`:'<span class="rtable-entry" style="color:rgba(255,255,255,.45);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)">Free</span>'}
        <span class="rtable-join">JOIN ▶</span>
      </div>
    </div>`;
  }

  // ── Cinematic Arena Setup ───────────────────────────────────────────────
  // Replaces the old bet picker with a full-screen "forge your arena" flow.
  // Returns: { bet, maxPlayers, isPrivate } or null on cancel.
  function showArenaSetup(){
    return new Promise(resolve=>{
      const old=document.getElementById('arena-setup');if(old)old.remove();
      _ensureArenaStyles();

      const cfg = { maxPlayers:4, bet:1000, isPrivate:false, invites:[] };
      const userCoins = S.user?.coins || 0;

      // Stake tiers — rarity tiers like a card game
      const tiers = [
        {val:100,    name:'STARTER', rarity:'a_rCommon',    color:'#9CA3AF', glow:'rgba(156,163,175,.55)',  icon:'🪙'},
        {val:500,    name:'BRONZE',  rarity:'a_rCommon',    color:'#D97706', glow:'rgba(217,119,6,.55)',    icon:'🥉'},
        {val:2000,   name:'SILVER',  rarity:'a_rRare',      color:'#D1D5DB', glow:'rgba(209,213,219,.6)',   icon:'🥈'},
        {val:8000,   name:'GOLD',    rarity:'a_rEpic',      color:'#FBBF24', glow:'rgba(251,191,36,.7)',    icon:'🥇'},
        {val:25000,  name:'DIAMOND', rarity:'a_rLegendary', color:'#67E8F9', glow:'rgba(103,232,249,.75)',  icon:'💎'},
        {val:100000, name:'MYTHIC',  rarity:'a_rMythic',    color:'#F472B6', glow:'rgba(244,114,182,.85)',  icon:'👑'}
      ];

      // Floating decorative cards in background
      const deco = ['#E8324A','#F59E0B','#16A34A','#2563EB','#9333EA','#E8324A','#F59E0B'].map((c,i)=>`
        <div class="arena-deco-card" style="
          --c:${c};
          left:${[8,18,72,82,15,68,40][i]}%;
          top:${[12,68,18,72,42,38,8][i]}%;
          animation-delay:${i*-2.3}s;
          animation-duration:${14+i*1.7}s;
          transform:rotate(${[-12,18,-25,14,-8,22,-30][i]}deg);
        "></div>
      `).join('');

      const ov = document.createElement('div');
      ov.id = 'arena-setup';
      ov.innerHTML = `
        <div class="arena-bg">${deco}<div class="arena-vignette"></div></div>
        <div class="arena-panel" role="dialog" aria-label="Create Room">
          <button class="arena-close" aria-label="Close">×</button>

          <div class="arena-header">
            <div class="arena-eyebrow">⚔️  ${t('a_eyebrow')}  ⚔️</div>
            <div class="arena-title">${t('a_title')}</div>
            <div class="arena-sub">${t('a_sub')}</div>
          </div>

          <div class="arena-coins">
            <span class="arena-coin-icon">🪙</span>
            <span class="arena-coin-val">${userCoins.toLocaleString()}</span>
            <span class="arena-coin-lbl">${t('a_vault')}</span>
          </div>

          <!-- PLAYERS -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">01</div>
              <div>
                <div class="arena-section-title">${t('a_fighters')}</div>
                <div class="arena-section-sub">${t('a_fightersSub')}</div>
              </div>
            </div>
            <div class="arena-players-grid">
              ${[2,3,4].map(n=>`
                <button class="arena-pcard ${n===4?'on':''}" data-players="${n}">
                  <div class="arena-pcard-slots">
                    ${Array.from({length:n}).map((_,i)=>`<div class="arena-pslot" style="--i:${i}"></div>`).join('')}
                  </div>
                  <div class="arena-pcard-num">${n}</div>
                  <div class="arena-pcard-lbl">${n===2?t('a_duel'):n===3?t('a_triple'):t('a_squad')}</div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- STAKE -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">02</div>
              <div>
                <div class="arena-section-title">${t('a_stake')}</div>
                <div class="arena-section-sub">${t('a_stakeSub')}</div>
              </div>
            </div>
            <div class="arena-tiers">
              ${tiers.map((t2,i)=>{
                const tooExpensive = t2.val > userCoins;
                const selected = t2.val === cfg.bet;
                return `
                <button class="arena-tier ${selected?'on':''} ${tooExpensive?'locked':''}"
                  data-bet="${t2.val}"
                  style="--tier-color:${t2.color};--tier-glow:${t2.glow}">
                  <div class="arena-tier-shine"></div>
                  <div class="arena-tier-icon">${t2.icon}</div>
                  <div class="arena-tier-name">${t2.name}</div>
                  <div class="arena-tier-rarity">${t(t2.rarity)}</div>
                  <div class="arena-tier-val">${t2.val.toLocaleString()}</div>
                  ${tooExpensive?'<div class="arena-tier-lock">🔒</div>':''}
                </button>`;
              }).join('')}
            </div>
          </div>

          <!-- PRIVACY -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">03</div>
              <div>
                <div class="arena-section-title">${t('a_access')}</div>
                <div class="arena-section-sub">${t('a_accessSub')}</div>
              </div>
            </div>
            <div class="arena-privacy">
              <button class="arena-priv on" data-priv="0">
                <div class="arena-priv-icon">🌐</div>
                <div>
                  <div class="arena-priv-title">${t('a_public')}</div>
                  <div class="arena-priv-sub">${t('a_publicSub')}</div>
                </div>
              </button>
              <button class="arena-priv" data-priv="1">
                <div class="arena-priv-icon">🔐</div>
                <div>
                  <div class="arena-priv-title">${t('a_private')}</div>
                  <div class="arena-priv-sub">${t('a_privateSub')}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- SQUAD -->
          <div class="arena-section">
            <div class="arena-section-head">
              <div class="arena-section-num">04</div>
              <div>
                <div class="arena-section-title">${t('a_squadTitle')}</div>
                <div class="arena-section-sub">${t('a_squadSub')}</div>
              </div>
            </div>
            <div class="arena-friends" id="arenaFriends">
              <div class="arena-friends-msg">${t('a_loadingFriends')}</div>
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="arena-actions">
            <button class="arena-cancel">${t('cancel')}</button>
            <button class="arena-go">
              <span class="arena-go-shine"></span>
              <span class="arena-go-label">${t('a_enterArena')}</span>
              <span class="arena-go-arrow">→</span>
            </button>
          </div>
          <div class="arena-go-foot" id="arenaGoFoot">
            ${t('a_stake')}: <b id="arenaSummary">🪙 ${cfg.bet.toLocaleString()}</b>
            · <b id="arenaSummary2">${cfg.maxPlayers} ${t('a_players')}</b>
            · <b id="arenaSummary3">${t('a_public')}</b>
            · <b id="arenaSummary4">${t('a_random')}</b>
          </div>
        </div>
      `;
      document.body.appendChild(ov);

      // ── Wire interactions ──────────────────────────────────────
      const summary  = ov.querySelector('#arenaSummary');
      const summary2 = ov.querySelector('#arenaSummary2');
      const summary3 = ov.querySelector('#arenaSummary3');
      const summary4 = ov.querySelector('#arenaSummary4');
      const goBtn    = ov.querySelector('.arena-go');

      function syncSummary(){
        const tier = tiers.find(tt=>tt.val===cfg.bet);
        summary.textContent  = `${tier?tier.icon:'🪙'} ${cfg.bet.toLocaleString()}`;
        summary2.textContent = `${cfg.maxPlayers} ${cfg.maxPlayers>1?t('a_players'):t('a_player')}`;
        summary3.textContent = cfg.isPrivate ? t('a_private') : t('a_public');
        summary4.textContent = cfg.invites.length
          ? `${cfg.invites.length} ${cfg.invites.length>1?t('a_friendsInvited'):t('a_friendInvited')}`
          : t('a_random');
        const canAfford = cfg.bet <= userCoins;
        goBtn.classList.toggle('disabled', !canAfford);
        goBtn.querySelector('.arena-go-label').textContent = canAfford ? t('a_enterArena') : t('a_notEnough');
      }
      syncSummary();

      // ── Friends to invite (loaded async) ───────────────────────
      (async ()=>{
        const box = ov.querySelector('#arenaFriends');
        if(!box) return;
        try{
          const d = await api('GET','/friends');
          const friends = (d.friends||[]).slice()
            .sort((a,b)=>(b.isOnline?1:0)-(a.isOnline?1:0));
          if(!friends.length){
            box.innerHTML = `<div class="arena-friends-msg">${t('a_noFriends')}</div>`;
            return;
          }
          box.innerHTML = friends.map(f=>`
            <button class="arena-friend ${f.isOnline?'':'off'}" data-fid="${f.id}" ${f.isOnline?'':'disabled'}>
              <span class="arena-friend-dot ${f.isOnline?'on':''}"></span>
              <span class="arena-friend-name">${esc(f.username)}</span>
              <span class="arena-friend-state">${f.isOnline?t('a_online'):t('a_offline')}</span>
              <span class="arena-friend-check">✓</span>
            </button>`).join('');
          box.querySelectorAll('.arena-friend:not(.off)').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const fid = btn.dataset.fid;
              const i = cfg.invites.indexOf(fid);
              if(i>=0){ cfg.invites.splice(i,1); btn.classList.remove('on'); }
              else { cfg.invites.push(fid); btn.classList.add('on'); }
              syncSummary();
            });
          });
        }catch(e){
          box.innerHTML = `<div class="arena-friends-msg">${t('a_friendsErr')}</div>`;
        }
      })();

      // Player count
      ov.querySelectorAll('.arena-pcard').forEach(btn=>{
        btn.addEventListener('click',()=>{
          ov.querySelectorAll('.arena-pcard').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.maxPlayers = parseInt(btn.dataset.players,10);
          syncSummary();
        });
      });

      // Stake tier
      ov.querySelectorAll('.arena-tier').forEach(btn=>{
        btn.addEventListener('click',()=>{
          if(btn.classList.contains('locked')) {
            btn.animate(
              [{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],
              {duration:300}
            );
            return;
          }
          ov.querySelectorAll('.arena-tier').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.bet = parseInt(btn.dataset.bet,10);
          syncSummary();
        });
      });

      // Privacy
      ov.querySelectorAll('.arena-priv').forEach(btn=>{
        btn.addEventListener('click',()=>{
          ov.querySelectorAll('.arena-priv').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          cfg.isPrivate = btn.dataset.priv === '1';
          syncSummary();
        });
      });

      // Close handlers
      function close(result){
        ov.classList.add('out');
        setTimeout(()=>{ ov.remove(); resolve(result); }, 250);
      }
      ov.querySelector('.arena-close').addEventListener('click',()=>close(null));
      ov.querySelector('.arena-cancel').addEventListener('click',()=>close(null));
      goBtn.addEventListener('click',()=>{
        if(goBtn.classList.contains('disabled')){
          toast(`Not enough coins! You have ${userCoins.toLocaleString()} 🪙`,'e');
          return;
        }
        close({ ...cfg });
      });
      // Escape closes
      const onKey = (e)=>{ if(e.key==='Escape'){ close(null); document.removeEventListener('keydown',onKey); } };
      document.addEventListener('keydown', onKey);
    });
  }

  function _ensureArenaStyles(){
    if(document.getElementById('arena-setup-styles')) return;
    const s = document.createElement('style');
    s.id = 'arena-setup-styles';
    s.textContent = `
      @keyframes arenaIn{from{opacity:0}to{opacity:1}}
      @keyframes arenaPanelIn{from{transform:translateY(40px) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      @keyframes arenaOut{to{opacity:0;transform:scale(.96)}}
      @keyframes arenaFloat{
        0%,100%{transform:translateY(0) rotate(var(--rot,0deg))}
        50%{transform:translateY(-22px) rotate(calc(var(--rot,0deg) + 6deg))}
      }
      @keyframes arenaDecoDrift{
        0%{transform:translate(0,0) rotate(var(--rot,0deg));opacity:.0}
        15%{opacity:.18}
        50%{transform:translate(20px,-30px) rotate(calc(var(--rot,0deg) + 10deg));opacity:.22}
        85%{opacity:.16}
        100%{transform:translate(0,0) rotate(var(--rot,0deg));opacity:0}
      }
      @keyframes arenaSlotPulse{
        0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}
        50%{box-shadow:0 0 0 6px rgba(245,158,11,.18)}
      }
      @keyframes arenaShine{
        0%{transform:translateX(-120%) skewX(-20deg)}
        100%{transform:translateX(250%) skewX(-20deg)}
      }
      @keyframes arenaTierPop{
        0%{transform:translateY(0) scale(1)}
        50%{transform:translateY(-8px) scale(1.05)}
        100%{transform:translateY(-4px) scale(1.02)}
      }

      #arena-setup{
        position:fixed;inset:0;z-index:1000;
        background:radial-gradient(ellipse at center, rgba(40,18,8,.55) 0%, rgba(0,0,0,.92) 70%);
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        display:flex;align-items:center;justify-content:center;
        animation:arenaIn .35s ease-out;
        overflow:hidden;padding:20px;
      }
      #arena-setup.out{animation:arenaOut .25s ease-out forwards}

      .arena-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
      .arena-deco-card{
        position:absolute;width:90px;height:130px;border-radius:14px;
        background:radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--c) 80%, white 0%), color-mix(in srgb, var(--c) 60%, black 40%));
        box-shadow:0 12px 40px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.08);
        opacity:.18;
        animation:arenaDecoDrift 16s ease-in-out infinite;
      }
      .arena-deco-card::after{
        content:'';position:absolute;inset:18%;border-radius:50%;
        background:rgba(255,255,255,.08);
      }
      .arena-vignette{
        position:absolute;inset:0;
        background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.5) 100%);
      }

      .arena-panel{
        position:relative;z-index:2;
        width:min(720px, 95vw);max-height:92vh;overflow-y:auto;overflow-x:hidden;
        background:linear-gradient(180deg, rgba(28,32,57,.85), rgba(19,23,41,.95));
        border:1px solid rgba(255,255,255,.08);border-radius:24px;
        padding:30px 32px 26px;
        box-shadow:0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(245,158,11,.05), inset 0 1px 0 rgba(255,255,255,.06);
        animation:arenaPanelIn .5s cubic-bezier(.2,.9,.3,1.2);
        scrollbar-width:thin;scrollbar-color:rgba(245,158,11,.3) transparent;
      }
      .arena-panel::-webkit-scrollbar{width:5px}
      .arena-panel::-webkit-scrollbar-thumb{background:rgba(245,158,11,.3);border-radius:5px}

      .arena-close{
        position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
        color:rgba(255,255,255,.7);font-size:22px;line-height:1;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        transition:all .2s;font-family:inherit;
      }
      .arena-close:hover{background:rgba(232,50,74,.2);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg)}

      .arena-header{text-align:center;margin-bottom:6px;padding-top:4px}
      .arena-eyebrow{
        font-size:10px;font-weight:800;letter-spacing:4px;color:#F59E0B;
        margin-bottom:8px;opacity:.85;
      }
      .arena-title{
        font-family:'Bangers', cursive;font-size:42px;letter-spacing:4px;
        background:linear-gradient(180deg, #FEF3C7 0%, #F59E0B 60%, #C2410C 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        text-shadow:0 2px 30px rgba(245,158,11,.4);
        line-height:1.05;margin-bottom:6px;
      }
      .arena-sub{font-size:12px;color:rgba(255,255,255,.55);font-weight:600;letter-spacing:.5px}

      .arena-coins{
        margin:14px auto 4px;display:inline-flex;align-items:center;gap:8px;
        padding:8px 16px;border-radius:30px;
        background:linear-gradient(135deg, rgba(245,158,11,.12), rgba(232,50,74,.08));
        border:1px solid rgba(245,158,11,.25);
        font-weight:800;font-size:13px;
        position:relative;left:50%;transform:translateX(-50%);
      }
      .arena-coin-icon{font-size:16px}
      .arena-coin-val{color:#F59E0B}
      .arena-coin-lbl{color:rgba(255,255,255,.5);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1px}

      .arena-section{margin-top:24px}
      .arena-section-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
      .arena-section-num{
        width:36px;height:36px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg, #F59E0B, #C2410C);
        border-radius:9px;font-family:'Bangers',cursive;
        font-size:18px;color:#1A0E04;
        box-shadow:0 4px 16px rgba(245,158,11,.35);
      }
      .arena-section-title{font-weight:800;font-size:16px;letter-spacing:.5px;color:#fff}
      .arena-section-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;font-weight:600}

      /* Players */
      .arena-players-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .arena-pcard{
        position:relative;padding:18px 12px 14px;border-radius:14px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.06);
        cursor:pointer;transition:all .25s ease;text-align:center;
        font-family:inherit;color:#fff;overflow:hidden;
      }
      .arena-pcard:hover{border-color:rgba(245,158,11,.3);transform:translateY(-2px);background:rgba(255,255,255,.04)}
      .arena-pcard.on{
        border-color:#F59E0B;background:rgba(245,158,11,.08);
        box-shadow:0 8px 24px rgba(245,158,11,.25), inset 0 1px 0 rgba(245,158,11,.2);
        transform:translateY(-3px);
      }
      .arena-pcard-slots{display:flex;justify-content:center;gap:5px;margin-bottom:8px;min-height:14px}
      .arena-pslot{
        width:14px;height:14px;border-radius:50%;
        background:linear-gradient(135deg, #E8324A, #F59E0B);
        opacity:.4;transition:all .2s;
      }
      .arena-pcard.on .arena-pslot{opacity:1;animation:arenaSlotPulse 1.6s ease-in-out infinite;animation-delay:calc(var(--i) * .12s)}
      .arena-pcard-num{font-family:'Bangers',cursive;font-size:36px;letter-spacing:2px;line-height:1}
      .arena-pcard-lbl{font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,.55);margin-top:4px;text-transform:uppercase}
      .arena-pcard.on .arena-pcard-lbl{color:#F59E0B}

      /* Tiers */
      .arena-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media (min-width:560px){.arena-tiers{grid-template-columns:repeat(6,1fr)}}
      .arena-tier{
        position:relative;padding:14px 8px 12px;border-radius:13px;
        background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.15));
        border:1.5px solid rgba(255,255,255,.07);
        cursor:pointer;transition:all .25s ease;text-align:center;
        font-family:inherit;color:#fff;overflow:hidden;
      }
      .arena-tier:hover:not(.locked){
        border-color:var(--tier-color);transform:translateY(-3px);
        box-shadow:0 10px 24px var(--tier-glow);
      }
      .arena-tier.on{
        border-color:var(--tier-color);
        background:linear-gradient(180deg, color-mix(in srgb, var(--tier-color) 12%, transparent), rgba(0,0,0,.1));
        box-shadow:0 12px 30px var(--tier-glow), inset 0 1px 0 color-mix(in srgb, var(--tier-color) 30%, transparent);
        animation:arenaTierPop .35s ease-out forwards;
      }
      .arena-tier.locked{opacity:.4;cursor:not-allowed}
      .arena-tier-shine{
        position:absolute;top:0;left:0;width:50%;height:100%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
        opacity:0;pointer-events:none;
      }
      .arena-tier.on .arena-tier-shine{opacity:1;animation:arenaShine 1.8s ease-in-out infinite}
      .arena-tier-icon{font-size:24px;line-height:1;margin-bottom:6px;filter:drop-shadow(0 2px 6px var(--tier-glow))}
      .arena-tier-name{font-family:'Bangers',cursive;font-size:14px;letter-spacing:1.5px;color:var(--tier-color);line-height:1}
      .arena-tier-rarity{font-size:8px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:3px}
      .arena-tier-val{font-size:12px;font-weight:800;margin-top:5px;color:rgba(255,255,255,.85)}
      .arena-tier-lock{position:absolute;top:6px;right:6px;font-size:11px;opacity:.7}

      /* Privacy */
      .arena-privacy{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .arena-priv{
        display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.06);
        cursor:pointer;transition:all .25s ease;text-align:left;
        font-family:inherit;color:#fff;
      }
      .arena-priv:hover{border-color:rgba(245,158,11,.3);background:rgba(255,255,255,.04)}
      .arena-priv.on{
        border-color:#F59E0B;background:rgba(245,158,11,.06);
        box-shadow:0 4px 16px rgba(245,158,11,.15);
      }
      .arena-priv-icon{font-size:22px;flex-shrink:0}
      .arena-priv-title{font-weight:800;font-size:13px;line-height:1}
      .arena-priv-sub{font-size:10px;color:rgba(255,255,255,.5);margin-top:3px;font-weight:600}

      /* Actions */
      .arena-actions{display:flex;gap:10px;margin-top:28px;align-items:stretch}
      .arena-cancel{
        flex:0 0 auto;padding:0 22px;
        background:transparent;border:1.5px solid rgba(255,255,255,.1);border-radius:13px;
        color:rgba(255,255,255,.65);font-family:inherit;font-size:13px;font-weight:700;
        cursor:pointer;transition:all .2s;
      }
      .arena-cancel:hover{border-color:rgba(255,255,255,.2);color:#fff}
      .arena-go{
        position:relative;flex:1;padding:18px 24px;
        background:linear-gradient(135deg, #E8324A 0%, #F59E0B 100%);
        border:none;border-radius:13px;
        color:#fff;font-family:'Bangers',cursive;font-size:22px;letter-spacing:3px;
        cursor:pointer;transition:all .25s;overflow:hidden;
        box-shadow:0 12px 30px rgba(232,50,74,.4), 0 0 0 1px rgba(255,255,255,.08) inset;
        display:flex;align-items:center;justify-content:center;gap:12px;
      }
      .arena-go:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(232,50,74,.55)}
      .arena-go:active{transform:translateY(0)}
      .arena-go.disabled{
        background:rgba(255,255,255,.05);color:rgba(255,255,255,.4);
        box-shadow:none;cursor:not-allowed;
      }
      .arena-go.disabled:hover{transform:none}
      .arena-go-shine{
        position:absolute;top:0;left:0;width:40%;height:100%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent);
        animation:arenaShine 2.6s ease-in-out infinite;
      }
      .arena-go.disabled .arena-go-shine{display:none}
      .arena-go-arrow{font-size:24px;line-height:1}
      .arena-go-foot{
        text-align:center;font-size:11px;color:rgba(255,255,255,.45);
        margin-top:10px;font-weight:600;letter-spacing:.5px;
      }
      .arena-go-foot b{color:rgba(255,255,255,.8);font-weight:800}

      .arena-friends{display:flex;flex-wrap:wrap;gap:8px}
      .arena-friends-msg{font-size:12px;color:rgba(255,255,255,.45);font-weight:600;line-height:1.5;padding:4px 2px}
      .arena-friend{
        display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:11px;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.07);
        cursor:pointer;transition:all .2s ease;font-family:inherit;color:#fff;
      }
      .arena-friend:hover:not(.off){border-color:rgba(245,158,11,.35);background:rgba(255,255,255,.05)}
      .arena-friend.on{border-color:#F59E0B;background:rgba(245,158,11,.1);box-shadow:0 4px 14px rgba(245,158,11,.2)}
      .arena-friend.off{opacity:.4;cursor:not-allowed}
      .arena-friend-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);flex-shrink:0}
      .arena-friend-dot.on{background:#4ade80;box-shadow:0 0 6px rgba(74,222,128,.6)}
      .arena-friend-name{font-weight:800;font-size:13px}
      .arena-friend-state{font-size:9px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px}
      .arena-friend-check{
        font-size:11px;font-weight:900;color:#F59E0B;width:0;overflow:hidden;
        transition:width .2s ease;
      }
      .arena-friend.on .arena-friend-check{width:13px}

      @media (max-width:520px){
        .arena-panel{padding:24px 18px 20px;border-radius:20px}
        .arena-title{font-size:32px;letter-spacing:3px}
        .arena-section-num{width:30px;height:30px;font-size:15px}
        .arena-pcard-num{font-size:30px}
        .arena-tiers{grid-template-columns:repeat(2,1fr)}
        .arena-go{font-size:18px;letter-spacing:2px;padding:15px 18px}
      }
    `;
    document.head.appendChild(s);
  }

  async function doCreate(){
    const result = await showArenaSetup();
    if(!result) return;
    const { bet, maxPlayers, isPrivate, invites=[] } = result;
    if((S.user?.coins||0) < bet) return toast(`Not enough coins! You have ${S.user?.coins||0} 🪙`,'e');
    try{
      const d = await api('POST','/rooms',{settings:{ maxPlayers, bet, isPrivate }});
      S.roomId = d.roomId;
      S.socket.emit('room:join',{roomId:d.roomId},(res)=>{
        if(!res.success) return toast(res.reason,'e');
        clearInterval(S.roomsTimer); showScreen('room-screen');
        const betLbl = bet ? ` | Bet: 🪙${bet.toLocaleString()}` : '';
        document.getElementById('ridlbl').textContent = `Room: ${d.roomId.substr(0,8).toUpperCase()}${betLbl}`;
        if(res.state?.players) renderWaiting(res.state.players);
        refreshRoom();
        if(d.code) showRoomCode(d.code);
        // Fire off invites to the friends picked in the Arena Setup
        if(invites.length){
          Promise.allSettled(invites.map(fid =>
            api('POST','/friends/invite',{ friendId:fid, roomId:d.roomId })
          )).then(rs=>{
            const ok = rs.filter(r=>r.status==='fulfilled').length;
            if(ok) toast(`🎮 Invite sent to ${ok} friend${ok>1?'s':''}!`,'s');
          });
        }
      });
    }catch(e){ toast(e.message,'e'); }
  }

  // ════════════════════════════════════════════════════════════════
  //  GAME CENTER — hub for Training, Schedule, Trophies, Achievements
  // ════════════════════════════════════════════════════════════════
  const _gc = { difficulty:'medium' };

  function showGameCenter(){
    const old=document.getElementById('gameCenter'); if(old) old.remove();
    _ensureGameCenterStyles();
    const ov=document.createElement('div');
    ov.id='gameCenter';
    ov.innerHTML=`
      <div class="gc-panel" role="dialog" aria-label="Game Center">
        <div class="gc-head">
          <button class="gc-back" id="gcBack" style="display:none">‹</button>
          <div class="gc-head-titles">
            <div class="gc-title" id="gcTitle">GAME CENTER</div>
            <div class="gc-subtitle" id="gcSubtitle">Everything in one place</div>
          </div>
          <button class="gc-close" id="gcClose" aria-label="Close">×</button>
        </div>
        <div class="gc-body" id="gcBody"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#gcClose').addEventListener('click',_gcClose);
    ov.querySelector('#gcBack').addEventListener('click',()=>_gcNav('hub'));
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _gcClose(); });
    _gcNav('hub');
  }
  function _gcClose(){
    const ov=document.getElementById('gameCenter');
    if(!ov) return;
    ov.classList.add('out');
    setTimeout(()=>ov.remove(),220);
  }
  function _gcNav(view){
    const body=document.getElementById('gcBody');
    const back=document.getElementById('gcBack');
    const title=document.getElementById('gcTitle');
    const sub=document.getElementById('gcSubtitle');
    if(!body) return;
    body.scrollTop=0;
    const meta={
      hub:         {t:t('g_hHub'),      s:t('g_everything')},
      training:    {t:t('g_hTraining'), s:t('g_hTrainingS')},
      schedule:    {t:t('g_hSchedule'), s:t('g_hScheduleS')},
      trophies:    {t:t('g_hTrophies'), s:t('g_hTrophiesS')},
      achievements:{t:t('g_hAch'),      s:t('g_hAchS')},
    }[view]||{t:t('g_hHub'),s:''};
    title.textContent=meta.t; sub.textContent=meta.s;
    back.style.display = view==='hub' ? 'none' : '';
    body.style.animation='none'; void body.offsetWidth; body.style.animation='gcFade .3s ease';
    if(view==='hub')          body.innerHTML=_gcHub();
    else if(view==='training')body.innerHTML=_gcTraining();
    else if(view==='schedule'){ body.innerHTML=_gcLoading(t('g_loadFixtures')); _gcLoadSchedule(); }
    else if(view==='trophies'){ body.innerHTML=_gcLoading(t('g_openCabinet')); _gcLoadTrophies(); }
    else if(view==='achievements') body.innerHTML=_gcAchievements();
  }
  function _gcLoading(msg){
    return `<div class="gc-loading"><div class="gc-spinner"></div><div>${esc(msg)}</div></div>`;
  }

  // ── Hub ──────────────────────────────────────────────────────────
  function _gcHub(){
    const items=[
      {v:'training',    icon:'🤖', c:'#06B6D4', t:t('g_trainingT'), d:t('g_trainingD')},
      {v:'schedule',    icon:'📅', c:'#16A34A', t:t('g_scheduleT'), d:t('g_scheduleD')},
      {v:'trophies',    icon:'🏆', c:'#F59E0B', t:t('g_trophiesT'), d:t('g_trophiesD')},
      {v:'achievements',icon:'🏅', c:'#A855F7', t:t('g_achT'),      d:t('g_achD')},
    ];
    return `<div class="gc-hub">
      ${items.map(it=>`
        <button class="gc-card" data-view="${it.v}" onclick="_gcNav('${it.v}')" style="--gc-c:${it.c}">
          <div class="gc-card-glow"></div>
          <div class="gc-card-icon">${it.icon}</div>
          <div class="gc-card-text">
            <div class="gc-card-title">${it.t}</div>
            <div class="gc-card-desc">${it.d}</div>
          </div>
          <div class="gc-card-arrow">›</div>
        </button>`).join('')}
    </div>`;
  }

  // ── Training Ground ──────────────────────────────────────────────
  function _gcTraining(){
    const levels=[
      {id:'easy',   icon:'🟢', name:t('g_rookie'),  c:'#22C55E', tag:t('g_easy'),   d:t('g_rookieD')},
      {id:'medium', icon:'🟡', name:t('g_veteran'), c:'#F59E0B', tag:t('g_medium'), d:t('g_veteranD')},
      {id:'hard',   icon:'🔴', name:t('g_master'),  c:'#EF4444', tag:t('g_hard'),   d:t('g_masterD')},
    ];
    return `<div class="gc-train">
      <div class="gc-train-hint">${t('g_trainHint')}</div>
      <div class="gc-levels">
        ${levels.map(l=>`
          <button class="gc-level ${l.id===_gc.difficulty?'on':''}" data-diff="${l.id}"
            onclick="_gcPickDiff('${l.id}')" style="--lv-c:${l.c}">
            <div class="gc-level-icon">${l.icon}</div>
            <div class="gc-level-name">${l.name}</div>
            <div class="gc-level-tag">${l.tag}</div>
            <div class="gc-level-desc">${l.d}</div>
            <div class="gc-level-check">✓</div>
          </button>`).join('')}
      </div>
      <button class="gc-train-go" id="gcTrainGo" onclick="startTraining()">
        <span class="gc-go-shine"></span>${t('g_enterTraining')} →
      </button>
    </div>`;
  }
  function _gcPickDiff(id){
    _gc.difficulty=id;
    document.querySelectorAll('.gc-level').forEach(b=>b.classList.toggle('on',b.dataset.diff===id));
  }
  function startTraining(){
    if(!S.socket?.connected) return toast('Not connected','e');
    const btn=document.getElementById('gcTrainGo');
    if(btn){ btn.disabled=true; btn.textContent=t('g_starting'); }
    S.socket.emit('practice:start',{difficulty:_gc.difficulty},(res)=>{
      if(!res||!res.success){
        if(btn){ btn.disabled=false; btn.innerHTML='<span class="gc-go-shine"></span>'+t('g_enterTraining')+' →'; }
        return toast(res?.reason||'Could not start training','e');
      }
      S.roomId=res.roomId;
      S.isSpectator=false;
      _gcClose();
      toast('🤖 Training match starting…','s');
      // server auto-starts and emits game:state which switches the screen
    });
  }

  // ── Match Schedule ───────────────────────────────────────────────
  async function _gcLoadSchedule(){
    const body=document.getElementById('gcBody');
    if(!body) return;
    try{
      const d=await api('GET','/league/me');
      const matches=(d.myMatches||[]).slice().sort((a,b)=>a.scheduledAt-b.scheduledAt);
      if(!matches.length){
        body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">📭</div>
          <div class="gc-empty-title">${t('g_noFixturesT')}</div>
          <div class="gc-empty-sub">${t('g_noFixturesS')}</div></div>`;
        return;
      }
      const now=d.serverNow||Date.now();
      const next=matches.find(m=>m.status==='scheduled');
      const rows=matches.map(m=>{
        const fin=m.status==='finished';
        const isNext=next&&m.id===next.id;
        const opp=m.opponent||{name:'TBD'};
        const res=m.result;
        const resCls=res==='W'?'win':res==='L'?'loss':res==='D'?'draw':'';
        const statusBadge = fin
          ? `<span class="gc-fix-res ${resCls}">${res||'-'} ${m.score||''}</span>`
          : m.playable
            ? `<span class="gc-fix-live">${t('g_liveNow')}</span>`
            : `<span class="gc-fix-soon">${_gcCountdown(m.scheduledAt-now)}</span>`;
        return `<div class="gc-fix ${isNext?'next':''} ${fin?'done':''}">
          ${isNext?`<div class="gc-fix-tag">${t('g_nextUp')}</div>`:''}
          <div class="gc-fix-date">
            <div class="gc-fix-day">${_gcDateParts(m.scheduledAt).day}</div>
            <div class="gc-fix-mon">${_gcDateParts(m.scheduledAt).mon}</div>
          </div>
          <div class="gc-fix-main">
            <div class="gc-fix-opp">${t('g_vs')} ${esc(opp.name)} ${opp.isBot?`<span class="gc-fix-bot">${t('g_bot')}</span>`:''}</div>
            <div class="gc-fix-when">${_gcDateParts(m.scheduledAt).full}</div>
          </div>
          <div class="gc-fix-status">${statusBadge}</div>
        </div>`;
      }).join('');
      body.innerHTML=`<div class="gc-sched">
        <div class="gc-sched-head">${t('g_season')} ${d.seasonNumber||1} · ${matches.length} ${t('g_fixtures')}</div>
        ${rows}
      </div>`;
    }catch(e){
      body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">⚠️</div>
        <div class="gc-empty-title">${t('g_schedErr')}</div>
        <div class="gc-empty-sub">${esc(e.message||t('g_tryLater'))}</div></div>`;
    }
  }
  function _gcDateParts(ts){
    const dt=new Date(ts);
    const loc=I18N.current||'en';
    const hh=String(dt.getHours()).padStart(2,'0');
    const mm=String(dt.getMinutes()).padStart(2,'0');
    let mon, full;
    try{
      mon=dt.toLocaleDateString(loc,{month:'short'}).toUpperCase();
      full=`${dt.toLocaleDateString(loc,{weekday:'short',day:'numeric',month:'long',year:'numeric'})} · ${hh}:${mm}`;
    }catch(e){
      mon=dt.toLocaleDateString('en',{month:'short'}).toUpperCase();
      full=`${dt.toLocaleDateString('en',{weekday:'short',day:'numeric',month:'long',year:'numeric'})} · ${hh}:${mm}`;
    }
    return { day:String(dt.getDate()), mon, full };
  }
  function _gcCountdown(ms){
    if(ms<=0) return t('g_soon');
    const d=Math.floor(ms/86400000);
    const h=Math.floor((ms%86400000)/3600000);
    const m=Math.floor((ms%3600000)/60000);
    if(d>0) return `${d}d ${h}h`;
    if(h>0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // ── Trophy Cabinet ───────────────────────────────────────────────
  async function _gcLoadTrophies(){
    const body=document.getElementById('gcBody');
    if(!body) return;
    try{
      const d=await api('GET','/rewards');
      const rewards=d.rewards||[];
      if(!rewards.length){
        body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">🗄️</div>
          <div class="gc-empty-title">${t('g_emptyCabT')}</div>
          <div class="gc-empty-sub">${t('g_emptyCabS')}</div></div>`;
        return;
      }
      const rows=rewards.map(r=>`
        <div class="gc-trophy">
          <div class="gc-trophy-icon">${r.icon||'🪙'}</div>
          <div class="gc-trophy-main">
            <div class="gc-trophy-label">${esc(r.label||t('g_reward'))}</div>
            <div class="gc-trophy-date">${_gcDateParts(r.at).full}</div>
          </div>
          <div class="gc-trophy-amt">+${(r.amount||0).toLocaleString()} 🪙</div>
        </div>`).join('');
      body.innerHTML=`<div class="gc-trophies">
        <div class="gc-trophy-banner">
          <div class="gc-trophy-banner-icon">🏆</div>
          <div>
            <div class="gc-trophy-banner-val">${(d.totalWon||0).toLocaleString()} 🪙</div>
            <div class="gc-trophy-banner-lbl">${t('g_totalWon')} ${d.count||0} ${d.count===1?t('g_reward'):t('g_rewards')}</div>
          </div>
        </div>
        ${rows}
      </div>`;
    }catch(e){
      body.innerHTML=`<div class="gc-empty"><div class="gc-empty-icon">⚠️</div>
        <div class="gc-empty-title">${t('g_trophyErr')}</div>
        <div class="gc-empty-sub">${esc(e.message||t('g_tryLater'))}</div></div>`;
    }
  }

  // ── Achievements ─────────────────────────────────────────────────
  function _gcAchievements(){
    const u=S.user||{};
    const gp=u.stats?.gamesPlayed||0, gw=u.stats?.gamesWon||0;
    const coins=u.coins||0, elo=u.elo||1000, tw=u.tournamentWins||0;
    const defs=[
      {icon:'🎮', name:t('ach_firstSteps'), desc:t('ach_firstStepsD'), cur:gp,    tgt:1},
      {icon:'🃏', name:t('ach_warm'),       desc:t('ach_warmD'),       cur:gp,    tgt:10},
      {icon:'🎯', name:t('ach_seasoned'),   desc:t('ach_seasonedD'),   cur:gp,    tgt:50},
      {icon:'🏆', name:t('ach_firstWin'),   desc:t('ach_firstWinD'),   cur:gw,    tgt:1},
      {icon:'🔥', name:t('ach_habit'),      desc:t('ach_habitD'),      cur:gw,    tgt:10},
      {icon:'👑', name:t('ach_champion'),   desc:t('ach_championD'),   cur:gw,    tgt:50},
      {icon:'💰', name:t('ach_collector'),  desc:t('ach_collectorD'),  cur:coins, tgt:10000},
      {icon:'💎', name:t('ach_roller'),     desc:t('ach_rollerD'),     cur:coins, tgt:100000},
      {icon:'⚔️', name:t('ach_victor'),     desc:t('ach_victorD'),     cur:tw,    tgt:1},
      {icon:'📈', name:t('ach_skilled'),    desc:t('ach_skilledD'),    cur:elo,   tgt:1300},
      {icon:'⭐', name:t('ach_elite'),      desc:t('ach_eliteD'),      cur:elo,   tgt:1600},
    ];
    const unlocked=defs.filter(a=>a.cur>=a.tgt).length;
    const cards=defs.map(a=>{
      const done=a.cur>=a.tgt;
      const pct=Math.min(100,Math.round((a.cur/a.tgt)*100));
      return `<div class="gc-ach ${done?'on':''}">
        <div class="gc-ach-icon">${done?a.icon:'🔒'}</div>
        <div class="gc-ach-main">
          <div class="gc-ach-name">${a.name}${done?` <span class="gc-ach-done">${t('g_unlocked')}</span>`:''}</div>
          <div class="gc-ach-desc">${a.desc}</div>
          <div class="gc-ach-bar"><div class="gc-ach-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="gc-ach-prog">${Math.min(a.cur,a.tgt).toLocaleString()}/${a.tgt.toLocaleString()}</div>
      </div>`;
    }).join('');
    return `<div class="gc-achs">
      <div class="gc-ach-banner">
        <div class="gc-ach-banner-val">${unlocked}<span>/${defs.length}</span></div>
        <div class="gc-ach-banner-lbl">${t('g_badgesUnlocked')}</div>
      </div>
      ${cards}
    </div>`;
  }

  function _ensureGameCenterStyles(){
    if(document.getElementById('gc-styles')) return;
    const s=document.createElement('style'); s.id='gc-styles';
    s.textContent=`
      @keyframes gcIn{from{opacity:0}to{opacity:1}}
      @keyframes gcOut{to{opacity:0}}
      @keyframes gcPanelIn{from{transform:translateY(34px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      @keyframes gcFade{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
      @keyframes gcSpin{to{transform:rotate(360deg)}}
      @keyframes gcShine{0%{transform:translateX(-120%) skewX(-20deg)}100%{transform:translateX(320%) skewX(-20deg)}}
      @keyframes gcPulse{0%,100%{opacity:1}50%{opacity:.4}}
      #gameCenter{
        position:fixed;inset:0;z-index:1000;
        background:rgba(4,6,14,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        display:flex;align-items:center;justify-content:center;padding:20px;
        animation:gcIn .3s ease;
      }
      #gameCenter.out{animation:gcOut .2s ease forwards}
      .gc-panel{
        width:min(680px,96vw);max-height:90vh;display:flex;flex-direction:column;
        background:linear-gradient(180deg,rgba(28,32,57,.96),rgba(17,21,38,.98));
        border:1px solid rgba(255,255,255,.08);border-radius:22px;overflow:hidden;
        box-shadow:0 40px 100px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05);
        animation:gcPanelIn .42s cubic-bezier(.2,.9,.3,1.2);
      }
      .gc-head{
        display:flex;align-items:center;gap:12px;padding:18px 20px;
        background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(168,85,247,.08));
        border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;
      }
      .gc-back,.gc-close{
        width:36px;height:36px;flex-shrink:0;border-radius:50%;cursor:pointer;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
        color:rgba(255,255,255,.8);font-size:22px;line-height:1;font-family:inherit;
        display:flex;align-items:center;justify-content:center;transition:all .2s;
      }
      .gc-back:hover{background:rgba(6,182,212,.2);border-color:rgba(6,182,212,.5);color:#fff}
      .gc-close:hover{background:rgba(232,50,74,.2);border-color:rgba(232,50,74,.5);color:#fff;transform:rotate(90deg)}
      .gc-head-titles{flex:1;min-width:0}
      .gc-title{font-family:'Bangers',cursive;font-size:24px;letter-spacing:2.5px;color:#fff;line-height:1}
      .gc-subtitle{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin-top:3px}
      .gc-body{
        padding:20px;overflow-y:auto;overflow-x:hidden;
        scrollbar-width:thin;scrollbar-color:rgba(6,182,212,.3) transparent;
      }
      .gc-body::-webkit-scrollbar{width:5px}
      .gc-body::-webkit-scrollbar-thumb{background:rgba(6,182,212,.3);border-radius:5px}

      /* Hub */
      .gc-hub{display:flex;flex-direction:column;gap:12px}
      .gc-card{
        position:relative;display:flex;align-items:center;gap:16px;
        padding:18px;border-radius:16px;cursor:pointer;overflow:hidden;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
        font-family:inherit;color:#fff;text-align:left;transition:all .25s ease;
      }
      .gc-card:hover{
        border-color:var(--gc-c);transform:translateX(4px);
        background:rgba(255,255,255,.05);
      }
      .gc-card-glow{
        position:absolute;left:-40px;top:50%;width:120px;height:120px;
        transform:translateY(-50%);border-radius:50%;
        background:var(--gc-c);opacity:.14;filter:blur(34px);pointer-events:none;
      }
      .gc-card-icon{
        font-size:32px;width:58px;height:58px;flex-shrink:0;border-radius:14px;
        display:flex;align-items:center;justify-content:center;
        background:color-mix(in srgb,var(--gc-c) 16%,transparent);
        border:1px solid color-mix(in srgb,var(--gc-c) 35%,transparent);
      }
      .gc-card-text{flex:1;min-width:0}
      .gc-card-title{font-weight:800;font-size:16px;color:#fff;margin-bottom:3px}
      .gc-card-desc{font-size:12px;color:rgba(255,255,255,.5);font-weight:600;line-height:1.4}
      .gc-card-arrow{font-size:26px;color:var(--gc-c);font-weight:700;flex-shrink:0}

      /* Loading / empty */
      .gc-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:50px 20px;color:rgba(255,255,255,.55);font-weight:600;font-size:13px}
      .gc-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#06B6D4;animation:gcSpin .8s linear infinite}
      .gc-empty{text-align:center;padding:46px 20px}
      .gc-empty-icon{font-size:48px;margin-bottom:12px;opacity:.7}
      .gc-empty-title{font-weight:800;font-size:16px;color:#fff;margin-bottom:6px}
      .gc-empty-sub{font-size:12px;color:rgba(255,255,255,.5);font-weight:600;max-width:340px;margin:0 auto;line-height:1.5}

      /* Training */
      .gc-train-hint{font-size:12px;color:rgba(255,255,255,.55);font-weight:600;text-align:center;margin-bottom:16px;line-height:1.5}
      .gc-levels{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
      .gc-level{
        position:relative;display:grid;grid-template-columns:auto auto 1fr;gap:4px 14px;
        align-items:center;padding:14px 16px;border-radius:14px;cursor:pointer;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
        font-family:inherit;color:#fff;text-align:left;transition:all .22s ease;
      }
      .gc-level:hover{border-color:var(--lv-c);background:rgba(255,255,255,.05)}
      .gc-level.on{border-color:var(--lv-c);background:color-mix(in srgb,var(--lv-c) 11%,transparent);box-shadow:0 6px 20px color-mix(in srgb,var(--lv-c) 28%,transparent)}
      .gc-level-icon{font-size:24px;grid-row:1/3}
      .gc-level-name{font-weight:800;font-size:15px}
      .gc-level-tag{
        font-size:9px;font-weight:800;letter-spacing:1.5px;padding:3px 8px;border-radius:20px;
        background:color-mix(in srgb,var(--lv-c) 20%,transparent);color:var(--lv-c);justify-self:start;
      }
      .gc-level-desc{grid-column:2/4;font-size:11px;color:rgba(255,255,255,.5);font-weight:600;line-height:1.4}
      .gc-level-check{
        position:absolute;top:12px;right:14px;width:22px;height:22px;border-radius:50%;
        background:var(--lv-c);color:#0B0E18;font-weight:900;font-size:13px;
        display:none;align-items:center;justify-content:center;
      }
      .gc-level.on .gc-level-check{display:flex}
      .gc-train-go,.arena-go-clone{position:relative}
      .gc-train-go{
        width:100%;padding:16px;border:none;border-radius:14px;cursor:pointer;overflow:hidden;
        background:linear-gradient(135deg,#06B6D4,#7C3AED);color:#fff;
        font-family:'Bangers',cursive;font-size:20px;letter-spacing:2.5px;
        box-shadow:0 12px 30px rgba(6,182,212,.4);transition:all .2s;
      }
      .gc-train-go:hover{transform:translateY(-2px);box-shadow:0 16px 38px rgba(6,182,212,.55)}
      .gc-train-go:disabled{opacity:.6;cursor:default;transform:none}
      .gc-go-shine{
        position:absolute;top:0;left:0;width:40%;height:100%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);
        animation:gcShine 2.6s ease-in-out infinite;
      }

      /* Schedule */
      .gc-sched{display:flex;flex-direction:column;gap:10px}
      .gc-sched-head{font-size:11px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:2px}
      .gc-fix{
        position:relative;display:flex;align-items:center;gap:14px;padding:13px 14px;
        border-radius:13px;background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
      }
      .gc-fix.next{border-color:rgba(6,182,212,.5);background:rgba(6,182,212,.07);padding-top:22px}
      .gc-fix.done{opacity:.72}
      .gc-fix-tag{
        position:absolute;top:7px;left:14px;font-size:8px;font-weight:800;letter-spacing:1.5px;
        color:#06B6D4;
      }
      .gc-fix-date{
        flex-shrink:0;width:48px;text-align:center;border-radius:10px;padding:6px 0;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
      }
      .gc-fix-day{font-family:'Bangers',cursive;font-size:22px;line-height:1;color:#fff}
      .gc-fix-mon{font-size:9px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,.5)}
      .gc-fix-main{flex:1;min-width:0}
      .gc-fix-opp{font-weight:800;font-size:14px;color:#fff;display:flex;align-items:center;gap:6px}
      .gc-fix-bot{font-size:8px;font-weight:800;letter-spacing:1px;background:rgba(96,165,250,.18);color:#60a5fa;padding:2px 6px;border-radius:10px}
      .gc-fix-when{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin-top:3px}
      .gc-fix-status{flex-shrink:0;text-align:right}
      .gc-fix-soon{font-size:11px;font-weight:800;color:rgba(255,255,255,.6)}
      .gc-fix-live{font-size:11px;font-weight:800;color:#22C55E;animation:gcPulse 1.4s ease-in-out infinite}
      .gc-fix-res{font-size:12px;font-weight:800;padding:4px 9px;border-radius:8px}
      .gc-fix-res.win{background:rgba(34,197,94,.18);color:#4ade80}
      .gc-fix-res.loss{background:rgba(239,68,68,.18);color:#f87171}
      .gc-fix-res.draw{background:rgba(245,158,11,.18);color:#fbbf24}

      /* Trophies */
      .gc-trophies{display:flex;flex-direction:column;gap:9px}
      .gc-trophy-banner{
        display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;margin-bottom:6px;
        background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(232,50,74,.08));
        border:1px solid rgba(245,158,11,.25);
      }
      .gc-trophy-banner-icon{font-size:34px}
      .gc-trophy-banner-val{font-family:'Bangers',cursive;font-size:26px;letter-spacing:1px;color:#F59E0B}
      .gc-trophy-banner-lbl{font-size:11px;color:rgba(255,255,255,.55);font-weight:600;margin-top:2px}
      .gc-trophy{
        display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:12px;
        background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.06);
      }
      .gc-trophy-icon{font-size:24px;flex-shrink:0;width:42px;height:42px;border-radius:11px;
        display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)}
      .gc-trophy-main{flex:1;min-width:0}
      .gc-trophy-label{font-weight:800;font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gc-trophy-date{font-size:10px;color:rgba(255,255,255,.45);font-weight:600;margin-top:2px}
      .gc-trophy-amt{font-weight:800;font-size:13px;color:#4ade80;flex-shrink:0}

      /* Achievements */
      .gc-achs{display:flex;flex-direction:column;gap:9px}
      .gc-ach-banner{
        text-align:center;padding:18px;border-radius:14px;margin-bottom:6px;
        background:linear-gradient(135deg,rgba(168,85,247,.16),rgba(6,182,212,.08));
        border:1px solid rgba(168,85,247,.25);
      }
      .gc-ach-banner-val{font-family:'Bangers',cursive;font-size:38px;letter-spacing:1px;color:#A855F7;line-height:1}
      .gc-ach-banner-val span{font-size:22px;color:rgba(255,255,255,.4)}
      .gc-ach-banner-lbl{font-size:11px;color:rgba(255,255,255,.55);font-weight:600;margin-top:4px}
      .gc-ach{
        display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:12px;
        background:rgba(255,255,255,.02);border:1.5px solid rgba(255,255,255,.05);
      }
      .gc-ach.on{background:rgba(168,85,247,.07);border-color:rgba(168,85,247,.3)}
      .gc-ach-icon{
        font-size:22px;flex-shrink:0;width:44px;height:44px;border-radius:11px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.04);
      }
      .gc-ach.on .gc-ach-icon{background:rgba(168,85,247,.16);filter:drop-shadow(0 2px 8px rgba(168,85,247,.5))}
      .gc-ach-main{flex:1;min-width:0}
      .gc-ach-name{font-weight:800;font-size:13px;color:#fff;display:flex;align-items:center;gap:7px}
      .gc-ach-done{font-size:8px;font-weight:800;letter-spacing:1px;background:rgba(168,85,247,.22);color:#c084fc;padding:2px 6px;border-radius:10px}
      .gc-ach-desc{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;margin:3px 0 6px}
      .gc-ach-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden}
      .gc-ach-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#A855F7,#06B6D4);transition:width .5s ease}
      .gc-ach-prog{font-size:10px;font-weight:800;color:rgba(255,255,255,.5);flex-shrink:0}

      @media (max-width:520px){
        .gc-title{font-size:20px}
        .gc-card-icon{width:48px;height:48px;font-size:26px}
        .gc-card-title{font-size:14px}
      }
    `;
    document.head.appendChild(s);
  }

  function doJoin(roomId){
    // Event rooms get a cinematic entry wipe before the screen swaps.
    EVENT.roomEnter(()=>_doJoinNow(roomId));
  }
  function _doJoinNow(roomId){
    S.roomId=roomId;
    S.socket.emit('room:join',{roomId},(res)=>{
      if(!res.success)return toast(res.reason,'e');
      clearInterval(S.roomsTimer);showScreen('room-screen');
      document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
      if(res.state?.players)renderWaiting(res.state.players);refreshRoom();
      EVENT.enterRoomAmbiance();
    });
  }
  function doWatch(roomId){
    if(!S.socket?.connected) return toast('Not connected','e');
    EVENT.roomEnter(()=>_doWatchNow(roomId));
  }
  function _doWatchNow(roomId){
    S.socket.emit('room:spectate',{roomId},(res)=>{
      if(!res.success) return toast(res.reason||'Could not join as spectator','e');
      S.roomId = roomId;
      S.isSpectator = true;
      clearInterval(S.roomsTimer);
      showScreen('game-screen');
      showChatFab(true);
      EVENT.enterRoomAmbiance();
      toast('👁️ Watching live!','s');
    });
  }
  function doLeaveSpectate(){
    if(!S.socket || !S.roomId) return;
    S.socket.emit('room:spectate_leave',{},()=>{
      S.roomId = null;
      S.isSpectator = false;
      showChatFab(false);
      goLobby();
    });
  }
  function refreshRoom(){if(!S.roomId)return;api('GET',`/rooms/${S.roomId}`).then(d=>{if(d.players)renderWaiting(d.players);}).catch(()=>{});}
  function renderWaiting(players){
    const list=document.getElementById('plist'),btn=document.getElementById('bstart');
    const host=players.find(p=>p.id===S.user?.id)?.isHost,ok=players.length>=2;
    list.innerHTML=players.map(p=>{
      const tag = p.isBot ? '<span style="margin-left:auto;font-size:10px;color:#60a5fa;font-weight:800">🤖 BOT</span>'
                : p.isHost ? '<span style="margin-left:auto;font-size:10px;color:var(--accent);font-weight:800">HOST</span>'
                : '';
      return `
      <div class="prow">
        <div class="pdot"></div><span>${esc(p.username)}</span>
        ${tag}
      </div>`;
    }).join('');
    // Don't override the button while the host is mid-start — let doStart manage it
    if(btn?.dataset.starting==='1') return;
    if(host){btn.disabled=!ok;btn.textContent=ok?`🎮 ${t('startGame')}`:`Need ${2-players.length} more`;}
    else{btn.disabled=true;btn.textContent=t('waitingHost');}
  }
  function doStart(){
    const btn=document.getElementById('bstart');
    if(btn?.dataset.starting==='1') return;
    if(btn){btn.dataset.starting='1';btn.disabled=true;btn.textContent='Starting...';}
    S.socket.emit('game:start',{},(res)=>{
      if(!res.success){
        if(btn){btn.dataset.starting='';btn.disabled=false;btn.textContent=`🎮 ${t('startGame')}`;}
        toast(res.reason,'e');
      }
    });
  }
  function doLeaveRoom(){S.socket.emit('room:leave',{},()=>{S.roomId=null;goLobby();});}
  async function doDaily(){
    try{const d=await api('POST','/coins/claim-daily');S.user.coins=d.coins;localStorage.setItem('uno_user',JSON.stringify(S.user));goLobby();toast(`🎁 +${d.earned} coins!`,'s');}
    catch(e){toast(e.message,'w');}
  }
  async function showCoinsModal(){
    const modal = document.getElementById('coinsModal');
    const u = S.user || {};
    document.getElementById('coinsHeroVal').textContent = (u.coins||0).toLocaleString();
    document.getElementById('coinsELO').textContent = u.elo ?? '—';
    document.getElementById('coinsGames').textContent = u.stats?.gamesPlayed ?? 0;
    document.getElementById('coinsWins').textContent = u.stats?.gamesWon ?? 0;
    const elo = u.elo || 1000;
    const league = elo >= 2000 ? '💎 Diamond' : elo >= 1500 ? '🥇 Gold' : elo >= 1000 ? '🥈 Silver' : '🥉 Bronze';
    document.getElementById('coinsLeague').textContent = league;
    modal.classList.add('show');
    try{
      const d=await api('GET','/auth/me');
      if(d.user){
        S.user=d.user;localStorage.setItem('uno_user',JSON.stringify(d.user));
        document.getElementById('coinsHeroVal').textContent = (d.user.coins||0).toLocaleString();
        document.getElementById('coinsELO').textContent = d.user.elo ?? '—';
        document.getElementById('coinsGames').textContent = d.user.stats?.gamesPlayed ?? 0;
        document.getElementById('coinsWins').textContent = d.user.stats?.gamesWon ?? 0;
        const e2 = d.user.elo || 1000;
        document.getElementById('coinsLeague').textContent = e2 >= 2000 ? '💎 Diamond' : e2 >= 1500 ? '🥇 Gold' : e2 >= 1000 ? '🥈 Silver' : '🥉 Bronze';
        document.getElementById('hcoins').textContent = d.user.coins||0;
        document.getElementById('scoins').textContent = d.user.coins||0;
      }
    }catch(e){}
  }
  // Preset character avatars — players pick one; custom image uploads are off.
  const AVATARS=[
    {e:'🥷',n:'Ninja'},{e:'🕵️',n:'Spy'},{e:'🦸',n:'Superhero'},{e:'🦹',n:'Villain'},
    {e:'🧙',n:'Wizard'},{e:'🧛',n:'Vampire'},{e:'🧟',n:'Zombie'},{e:'🧞',n:'Genie'},
    {e:'🧜',n:'Merman'},{e:'🧚',n:'Fairy'},{e:'🧝',n:'Elf'},{e:'🦾',n:'Iron Man'},
    {e:'🤖',n:'Robot'},{e:'👽',n:'Alien'},{e:'👾',n:'Invader'},{e:'👻',n:'Ghost'},
    {e:'🤡',n:'Joker'},{e:'👹',n:'Ogre'},{e:'👺',n:'Goblin'},{e:'☠️',n:'Pirate'},
    {e:'🤠',n:'Cowboy'},{e:'🤴',n:'King'},{e:'👸',n:'Queen'},{e:'👮',n:'Officer'},
    {e:'💂',n:'Guard'},{e:'🧑‍🚀',n:'Astronaut'},{e:'🧑‍🚒',n:'Firefighter'},{e:'🎅',n:'Santa'},
    {e:'⛄',n:'Iceman'},{e:'🔥',n:'Blaze'},{e:'⚡',n:'Bolt'},{e:'🐲',n:'Dragon'},
    {e:'🦁',n:'Lion'},{e:'🐺',n:'Wolf'},{e:'🦅',n:'Eagle'},{e:'🦈',n:'Shark'},
    {e:'🦄',n:'Unicorn'},{e:'🐯',n:'Tiger'},{e:'🦊',n:'Fox'},{e:'🐉',n:'Serpent'},
  ];
  function _avatarName(e){ const a=AVATARS.find(x=>x.e===e); return a?a.n:''; }
  function _isImgAvatar(a){ return typeof a==='string' && /^(data:|https?:|\/)/i.test(a); }
  function _renderAvatarInto(el, user){
    if(!el || !user) return;
    el.classList.remove('has-img');
    el.style.backgroundImage = '';
    if(_isImgAvatar(user.avatar)){
      el.classList.add('has-img');
      el.style.backgroundImage = `url('${user.avatar}')`;
      el.textContent = '';
    } else if(user.avatar){
      el.textContent = user.avatar; // preset emoji avatar
    } else {
      el.textContent = (user.username||'?').charAt(0).toUpperCase();
    }
  }
  // Apply an avatar instantly (optimistic) and persist in the background.
  async function _applyAvatar(av){
    const prev = S.user?.avatar;
    if(S.user){ S.user.avatar = av; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
    _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
    _renderAvatarInto(document.getElementById('heroAvatar'), S.user);
    try{
      await api('POST','/profile/avatar',{ avatar: av });
      toast('✅ '+t('avatarUpdated'),'s');
    }catch(e){
      // Roll back if the server rejected it
      if(S.user){ S.user.avatar = prev; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
      _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
      _renderAvatarInto(document.getElementById('heroAvatar'), S.user);
      toast(e.message||'Could not save avatar','e');
    }
  }
  function showAvatarPicker(){
    const old=document.getElementById('avatarPicker'); if(old) old.remove();
    _ensureAvatarStyles();
    const cur=S.user?.avatar;
    const ov=document.createElement('div');
    ov.id='avatarPicker';
    ov.innerHTML=`
      <div class="av-panel">
        <div class="av-title">${esc(t('chooseAvatar'))}</div>
        <div class="av-sub">${esc(t('chooseAvatarSub'))}</div>
        <div class="av-stage">
          <div class="av-stage-ring"></div>
          <div class="av-stage-face" id="avStageFace">${cur&&!_isImgAvatar(cur)?cur:'🎮'}</div>
        </div>
        <div class="av-stage-name" id="avStageName">${esc(_avatarName(cur)||'')}</div>
        <div class="av-grid">
          ${AVATARS.map((a,i)=>`
            <button class="av-tile ${a.e===cur?'on':''}" data-av="${a.e}" data-name="${esc(a.n)}" style="animation-delay:${i*20}ms">
              <span class="av-face">${a.e}</span>
              <span class="av-name">${esc(a.n)}</span>
            </button>`).join('')}
        </div>
        <button class="av-done" id="avPickClose">${esc(t('close'))}</button>
      </div>`;
    document.body.appendChild(ov);
    const stage=ov.querySelector('#avStageFace');
    const stageName=ov.querySelector('#avStageName');
    ov.querySelectorAll('.av-tile').forEach(b=>{
      b.addEventListener('click',()=>{
        const av=b.dataset.av;
        ov.querySelectorAll('.av-tile').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        // confirm pop + preview on the stage
        b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:320,easing:'cubic-bezier(.34,1.56,.64,1)'});
        if(stage){ stage.textContent=av; stage.animate([{transform:'rotateY(90deg) scale(.6)'},{transform:'rotateY(0) scale(1)'}],{duration:380,easing:'cubic-bezier(.2,.9,.3,1.2)'}); }
        if(stageName) stageName.textContent=b.dataset.name||'';
        _applyAvatar(av);
      });
      // pointer-tracking 3D tilt
      b.addEventListener('pointermove',e=>{
        const r=b.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
        b.style.transform=`translateY(-6px) rotateX(${-py*22}deg) rotateY(${px*22}deg) scale(1.08)`;
      });
      b.addEventListener('pointerleave',()=>{ b.style.transform=''; });
    });
    ov.querySelector('#avPickClose').addEventListener('click',()=>ov.remove());
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }
  function _ensureAvatarStyles(){
    if(document.getElementById('av-styles')) return;
    const s=document.createElement('style'); s.id='av-styles';
    s.textContent=`
      @keyframes avTileIn{from{opacity:0;transform:translateY(16px) rotateX(40deg)}to{opacity:1;transform:translateY(0) rotateX(0)}}
      @keyframes avFloat{0%,100%{transform:translateZ(26px) translateY(0)}50%{transform:translateZ(26px) translateY(-5px)}}
      @keyframes avRingSpin{to{transform:rotate(360deg)}}
      @keyframes avFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes avPanelIn{from{transform:translateY(40px) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      #avatarPicker{
        position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;
        background:radial-gradient(ellipse at 50% 40%,rgba(40,20,8,.5),rgba(4,6,14,.92));
        backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:avFadeIn .25s ease;
      }
      .av-panel{
        width:min(460px,95vw);max-height:90vh;display:flex;flex-direction:column;align-items:center;
        background:linear-gradient(180deg,rgba(30,34,60,.97),rgba(16,20,36,.99));
        border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:24px;
        box-shadow:0 40px 100px rgba(0,0,0,.75);animation:avPanelIn .45s cubic-bezier(.2,.9,.3,1.2);
      }
      .av-title{font-family:'Bangers',cursive;font-size:27px;letter-spacing:2px;color:#fff;text-align:center}
      .av-sub{font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-top:3px;font-weight:600}
      .av-stage{position:relative;width:108px;height:108px;margin:14px 0 4px;display:flex;align-items:center;justify-content:center}
      .av-stage-name{font-family:'Bangers',cursive;font-size:21px;letter-spacing:1.5px;color:#F59E0B;min-height:24px;margin-bottom:12px;text-shadow:0 2px 10px rgba(245,158,11,.4)}
      .av-stage-ring{
        position:absolute;inset:-6px;border-radius:50%;
        background:conic-gradient(from 0deg,#F59E0B,#E8324A,#7C3AED,#06B6D4,#F59E0B);
        animation:avRingSpin 4s linear infinite;filter:blur(3px);opacity:.85;
      }
      .av-stage-face{
        position:relative;width:100px;height:100px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-size:52px;
        background:radial-gradient(circle at 38% 32%,#3a4170,#141826);
        box-shadow:inset 0 4px 14px rgba(0,0,0,.55),0 8px 20px rgba(0,0,0,.5);
        filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));
      }
      .av-grid{
        display:grid;grid-template-columns:repeat(4,1fr);gap:10px;
        width:100%;overflow-y:auto;padding:6px;perspective:900px;
      }
      .av-grid::-webkit-scrollbar{width:5px}
      .av-grid::-webkit-scrollbar-thumb{background:rgba(245,158,11,.35);border-radius:5px}
      .av-tile{
        border:none;border-radius:15px;cursor:pointer;padding:11px 4px 8px;
        background:linear-gradient(160deg,#2c3258,#171b2d);
        display:flex;flex-direction:column;align-items:center;gap:5px;
        transform-style:preserve-3d;
        transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;
        box-shadow:0 6px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
        animation:avTileIn .4s cubic-bezier(.16,1,.3,1) backwards;
      }
      .av-tile .av-face{
        font-size:32px;display:block;transform:translateZ(16px);line-height:1;
        filter:drop-shadow(0 5px 5px rgba(0,0,0,.55));transition:transform .2s;
      }
      .av-tile .av-name{
        font-size:8.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;
        color:rgba(255,255,255,.55);transition:color .2s;
      }
      .av-tile:hover{box-shadow:0 16px 32px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
      .av-tile:hover .av-face{transform:translateZ(30px) scale(1.14)}
      .av-tile:active{transform:scale(.94)!important}
      .av-tile.on{
        background:linear-gradient(160deg,#6a4715,#2a1c08);
        box-shadow:0 0 0 2px #F59E0B,0 12px 28px rgba(245,158,11,.45),inset 0 1px 0 rgba(255,255,255,.15);
      }
      .av-tile.on .av-face{animation:avFloat 2.2s ease-in-out infinite}
      .av-tile.on .av-name{color:#F59E0B}
      .av-done{
        margin-top:16px;width:100%;padding:13px;border-radius:13px;cursor:pointer;
        background:transparent;border:1.5px solid rgba(255,255,255,.12);
        color:rgba(255,255,255,.7);font-family:inherit;font-weight:800;font-size:13px;
        transition:all .2s;
      }
      .av-done:hover{border-color:var(--accent);color:#fff;background:rgba(245,158,11,.08)}
    `;
    document.head.appendChild(s);
  }
  function copyProfileId(){
    const id = S.user?.id || '';
    if(!id) return;
    navigator.clipboard?.writeText(id);
    toast('🆔 ID copied to clipboard','s');
  }
  async function uploadAvatar(ev){
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if(!file) return;
    if(file.size > 3 * 1024 * 1024) return toast('Image too large (max 3MB)','e');
    if(!file.type.startsWith('image/')) return toast('Please pick an image','e');
    const reader = new FileReader();
    reader.onload = async () => {
      // Downscale to ~256px so we don't blow up storage
      const dataUrl = await _downscaleImage(reader.result, 256);
      try{
        const res = await api('POST','/profile/avatar',{ avatar: dataUrl });
        if(S.user){ S.user.avatar = res.avatar; localStorage.setItem('uno_user', JSON.stringify(S.user)); }
        _renderAvatarInto(document.getElementById('profileAvatar'), S.user);
        toast('Avatar updated! 📸','s');
      } catch(e){ toast(e.message || 'Upload failed','e'); }
    };
    reader.readAsDataURL(file);
  }
  function _downscaleImage(dataUrl, maxSize){
    return new Promise((resolve)=>{
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  function _animateCount(id, target){
    const el=document.getElementById(id); if(!el) return;
    const dur=900, start=performance.now();
    const fmt=v=>Math.round(v).toLocaleString();
    function tick(t){
      const p=Math.min(1,(t-start)/dur);
      const eased=1-Math.pow(1-p,3);
      el.textContent=fmt(target*eased);
      if(p<1) requestAnimationFrame(tick);
      else el.textContent=fmt(target);
    }
    requestAnimationFrame(tick);
  }
  async function showProfile(){
    // Open the modal immediately so the entrance animation isn't gated on the API.
    const ov=document.getElementById('profileOv'); if(ov) ov.classList.add('show');
    // Reset the bar so it animates from 0 every time the modal opens.
    const bar=document.getElementById('pWinBar'); if(bar) bar.style.width='0%';
    let u=S.user;
    try{
      const d=await api('GET','/auth/me');
      u=d.user;
      S.user=u; localStorage.setItem('uno_user',JSON.stringify(u));
    }catch(e){ /* fall back to cached user */ }
    if(!u) return;
    document.getElementById('profileName').textContent=u.username||'Player';
    const lg=u.league||{};
    const lgEl=document.getElementById('profileLeague');
    if(lgEl) lgEl.textContent=`${lg.badge||'🎖️'} ${lg.name||'Bronze'} League`;
    document.getElementById('profileId').textContent='ID '+(u.id||'').slice(0,8).toUpperCase();
    _renderAvatarInto(document.getElementById('profileAvatar'), u);
    document.getElementById('profileJoined').textContent='Joined '+(u.createdAt?new Date(u.createdAt).toLocaleDateString(I18N.current||'en'):'—');
    const played=u.stats?.gamesPlayed||0;
    const won=u.stats?.gamesWon||0;
    const rate=played>0?Math.round((won/played)*100):0;
    _animateCount('pCoins',  u.coins||0);
    _animateCount('pRating', u.elo??1000);
    _animateCount('pWon',    won);
    _animateCount('pPlayed', played);
    document.getElementById('pWinRate').textContent=rate+'%';
    requestAnimationFrame(()=>{ if(bar) bar.style.width=rate+'%'; });
  }
  async function showAdminPanel(){
    if(!S.user?.username?.toLowerCase().includes('mustapha')) return toast('Admin only','e');
    document.getElementById('adminOv').classList.add('show');
  }

  async function adminCreateTournament(){
    const name = document.getElementById('adminTName').value.trim() || 'UNO Championship';
    const maxPlayers = parseInt(document.getElementById('adminTMax').value) || 8;
    const prizeCoins = parseInt(document.getElementById('adminTPrize').value) || 5000;
    try{
      const res = await fetch('/api/tournament/create', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, maxPlayers, prizeCoins, secret:'uno_admin_2024' })
      });
      const d = await res.json();
      if(d.error) return toast(d.error,'e');
      toast(`Tournament "${d.tournament.name}" created! 🏆`,'s');
      document.getElementById('adminOv').classList.remove('show');
    } catch(e){ toast('Error creating tournament','e'); }
  }

  async function adminStartTournament(){
    const id = document.getElementById('adminTId').value.trim();
    if(!id) return toast('Enter tournament ID','e');
    try{
      const d = await apiFetch(`/api/tournaments/${id}/start`, {
        method:'POST',
        body: JSON.stringify({ secret:'uno_admin_2024' })
      }).catch(err=>({error:err.message}));
      if(d?.error) return toast(d.error,'e');
      toast('Tournament started! ⚔️','s');
    } catch(e){ toast('Error','e'); }
  }

  async function showLeaderboard(){
    try{
      const d=await api('GET','/leaderboard');
      const list=document.getElementById('lbList');
      list.innerHTML=d.leaderboard.map((p,i)=>{
        const rankClass=i===0?'gold':i===1?'silver':i===2?'bronze':'normal';
        const medal=i===0?'👑':i===1?'🥈':i===2?'🥉':'';
        return`<div class="lb-row">
          <div class="lb-rank ${rankClass}">${medal||p.rank}</div>
          <div class="lb-name">${p.username}</div>
          <div style="text-align:right">
            <div class="lb-coins">🪙 ${p.coins.toLocaleString()}</div>
            <div class="lb-wins">${p.gamesWon}W / ${p.gamesPlayed}P</div>
          </div>
        </div>`;
      }).join('');
      if(!d.leaderboard.length)list.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px">No players yet</div>';
      document.getElementById('lbOv').classList.add('show');
    }catch(e){toast('Could not load leaderboard','e');}
  }
  async function doInsta(){
    window.open('https://www.instagram.com/mustapha_elmway?igsh=MWM3b2VlZzRlY2R0aw%3D%3D&utm_source=qr','_blank');
    setTimeout(async()=>{
      try{const d=await api('POST','/coins/insta-reward');S.user.coins=d.coins;localStorage.setItem('uno_user',JSON.stringify(S.user));goLobby();toast(`📸 +${d.earned} coins! Thanks for following!`,'s');}
      catch(e){toast(e.message,'w');}
    },3000);
  }
  function doMM(){
    S.socket.emit('matchmaking:join',{},(res)=>{
      if(res.success){
        document.getElementById('mmcnt').textContent=`${res.queueSize} ${t('inQueue')}`;
        _openMatchmaking();
      }
    });
  }
  function _mmReduced(){ return matchMedia('(prefers-reduced-motion:reduce)').matches; }
  function _openMatchmaking(){
    const ov=document.getElementById('mmov'); if(!ov) return;
    ov.classList.add('show');
    const g=window.gsap;
    if(g && !_mmReduced()){
      // Cinematic camera push — the lobby drops back into depth
      g.to('#lobby-screen',{scale:1.12,opacity:.35,duration:.75,ease:'power2.in',transformOrigin:'50% 44%'});
      g.fromTo(ov,{opacity:0},{opacity:1,duration:.3,ease:'power1.out'});
      g.fromTo('.mm-radar',{scale:.45,opacity:0},{scale:1,opacity:1,duration:.7,ease:'back.out(1.7)',delay:.12});
      g.fromTo(['.mm-title','.mm-sub','.mm-hint','.mm-cancel'],
        {y:26,opacity:0},{y:0,opacity:1,duration:.5,stagger:.08,ease:'power3.out',delay:.22});
    }
  }
  function _resetLobbyCamera(){
    const g=window.gsap;
    if(g) g.set('#lobby-screen',{clearProps:'transform,opacity'});
    else { const ls=document.getElementById('lobby-screen'); if(ls){ls.style.transform='';ls.style.opacity='';} }
  }
  function _closeMatchmaking(){
    const ov=document.getElementById('mmov'); if(!ov) return;
    const g=window.gsap;
    if(g && !_mmReduced()){
      g.to('#lobby-screen',{scale:1,opacity:1,duration:.5,ease:'power2.out',clearProps:'transform,opacity'});
      g.to(ov,{opacity:0,duration:.3,ease:'power1.in',onComplete:()=>{ov.classList.remove('show');g.set(ov,{clearProps:'opacity'});}});
    } else {
      ov.classList.remove('show'); _resetLobbyCamera();
    }
  }
  function doLeaveMM(){ S.socket.emit('matchmaking:leave',{}); _closeMatchmaking(); }

  /* ═══ GAME ACTIONS ═══ */
  function playCard(cardId){
    if(!canIPlay())return toast("Not your turn!",'e');
    const card=S.g.myHand.find(c=>c.id===cardId);if(!card)return;
    if(card.isWild){S.pendingWild=cardId;document.getElementById('cmodal').classList.add('show');return;}
    const el=document.querySelector(`.hcard[onclick*="${cardId}"]`);
    if(el){
      el.classList.add('playing');
      el.style.pointerEvents='none';
      const rect=el.getBoundingClientRect();
      const top=document.getElementById('topcard').getBoundingClientRect();
      const dx=top.left-rect.left;
      const dy=top.top-rect.top;
      el.style.setProperty('--fly-x',dx+'px');
      el.style.setProperty('--fly-y',dy+'px');
    }
    setTimeout(()=>{
      S.socket.emit('game:play_card',{cardId},(res)=>{
        if(!res.success){toast(res.reason,'e');SFX.play('error');if(el){el.classList.remove('playing');el.style.pointerEvents='';}}
        else{
          document.getElementById('cancelArea').style.display='none';
          if(S.g.myHand.length!==1)S.calledUNO=false;
          const myCard=S.g?.myHand?.find(c=>c.id===cardId);
          const pileEl=document.getElementById('topCard');
          if(myCard)AnimLayer.play(myCard,el,pileEl);
          SFX.play('play');
        }
      });
    },300);
  }
  function pickColor(color){
    document.getElementById('cmodal').classList.remove('show');
    const cardId=S.pendingWild;S.pendingWild=null;if(!cardId)return;
    S.socket.emit('game:play_card',{cardId,chosenColor:color},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{document.getElementById('cancelArea').style.display='none';toast(`Color: ${color.toUpperCase()}!`,'s');SFX.play('play');}
    });
  }
  function doDraw(){
    if(!canIDraw())return toast(canIPlay()?'Already drew — play or cancel':'Not your turn!','e');
    if(S.g.stackDraw>0)toast(`Taking ${S.g.stackDraw} stacked cards!`,'w');
    S.socket.emit('game:draw_card',{},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{
        const deckEl=document.getElementById('drawPile');
        const handEl=document.getElementById('myHand');
        AnimLayer.draw(null,deckEl,handEl);
      }
    });
  }
  function doCancel(){
    document.getElementById('cancelArea').style.display='none';S.g.turnPhase='waiting';
    S.socket.emit('game:pass',{},(res)=>{if(res&&!res.success)toast(res.reason||'Error','e');});
  }
  function doUNO(){
    if(S.g.myHand.length!==1)return toast('Need exactly 1 card!','e');
    S.socket.emit('game:call_uno',{},(res)=>{
      if(res.success){S.calledUNO=true;toast('UNO! 🎉','s');SFX.play('uno');updateUNOButton();}
      else toast(res.reason,'e');
    });
  }
  function showCatchButton(targetId){
    document.querySelectorAll('.opanel').forEach(p=>{
      if(p.dataset.pid===targetId){
        p.querySelectorAll('.catch-btn').forEach(b=>b.remove());
        const btn=document.createElement('button');btn.className='catch-btn';btn.textContent='CATCH!';
        btn.onclick=(e)=>{e.stopPropagation();S.socket.emit('game:catch_uno',{targetId},(res)=>{
          if(res.success)toast('Caught them! +2 cards!','s');else toast(res.reason,'e');removeCatch();});};
        p.appendChild(btn);setTimeout(()=>btn.remove(),2500);
      }
    });
  }
  function removeCatch(){document.querySelectorAll('.catch-btn').forEach(b=>b.remove());}
  function toggleGameMenu(){document.getElementById('gameMenu').classList.toggle('show');}
  function gameMenuProfile(){
    document.getElementById('gameMenu').classList.remove('show');
    setTimeout(()=>showProfile(),120);
  }
  function gameMenuLogout(){
    document.getElementById('gameMenu').classList.remove('show');
    if(S.roomId){
      if(!confirm('You are in a game. Logging out will forfeit it. Continue?')) return;
      S.socket?.emit('room:leave',{},()=>{ S.roomId=null; doLogout(); });
    } else {
      doLogout();
    }
  }
  let soundOn=true;
  function refreshSoundLabel(){
    const el=document.getElementById('soundLabel');
    if(el) el.textContent=`${t('sound')}: ${soundOn?'ON':'OFF'}`;
  }
  function toggleSound(){
    soundOn=!soundOn;
    refreshSoundLabel();
  }
  function confirmLeave(){
    toggleGameMenu();
    if(S.isSpectator){ doLeaveSpectate(); return; }
    if(confirm('Are you sure? You will lose the bet and your opponent wins!')){doLeaveGame();}
  }
  function doLeaveGame(){
    S.socket.emit('room:leave',{},()=>{
      S.roomId=null;showChatFab(false);Chat.open=false;
      document.getElementById('chatPanel').classList.remove('open');
      document.getElementById('chatMsgs').innerHTML='';document.getElementById('activityMsgs').innerHTML='';
      Chat.unread=0;updateChatBadge();goLobby();
    });
  }

  /* ═══ WIN ═══ */
  function showWin(data){
    const iWon=data.winnerId===S.user?.id;
    if(data.eloChange) showEloPopup(data.eloChange, iWon);
    const bet=data.bet||0;
    const forfeit=data.forfeit||false;
    if(iWon&&data.coinsEarned){S.user.coins=(S.user.coins||0)+data.coinsEarned;localStorage.setItem('uno_user',JSON.stringify(S.user));}
    else if(!iWon){S.user.coins=Math.max(0,(S.user.coins||0)-bet);localStorage.setItem('uno_user',JSON.stringify(S.user));}
    const wt=document.getElementById('wtitle');
    wt.textContent=iWon?'🏆 YOU WIN!':'💀 GAME OVER';
    wt.className=`wtitle ${iWon?'w':'l'}`;
    document.getElementById('wdet').textContent=iWon?(forfeit?`${data.quitter} left the game!`:`Score: ${data.score}`):`${data.username} won!`;
    const finalCoins=iWon?(data.coinsEarned||0):-bet;
    const coinsEl=document.getElementById('wcoins');
    coinsEl.textContent=(finalCoins>=0?'+':'')+'0 🪙';
    document.getElementById('wbet').textContent=bet?`Bet was 🪙${bet} per player`:'';
    // Man of the Match
    const mvpBox=document.getElementById('mvpBadge');
    if(data.mvp && mvpBox){
      const av=document.getElementById('mvpAvatar');
      if(data.mvp.avatar){av.style.backgroundImage=`url('${data.mvp.avatar}')`;av.textContent='';}
      else{av.style.backgroundImage='';av.textContent=(data.mvp.username||'?').charAt(0).toUpperCase();}
      document.getElementById('mvpName').textContent=data.mvp.username||'—';
      document.getElementById('mvpReason').textContent=data.mvp.reason||'';
      mvpBox.style.display='flex';
    } else if(mvpBox){
      mvpBox.style.display='none';
    }
    // Crowd favorite — only shown when at least one spectator voted
    const cfBox=document.getElementById('crowdFav');
    if(data.crowdFavorite && cfBox){
      const cf=data.crowdFavorite;
      const av=document.getElementById('crowdFavAvatar');
      if(cf.avatar){av.style.backgroundImage=`url('${cf.avatar}')`;av.textContent='';}
      else{av.style.backgroundImage='';av.textContent=(cf.username||'?').charAt(0).toUpperCase();}
      document.getElementById('crowdFavName').textContent=cf.username||'—';
      const pct=cf.total?Math.round((cf.votes/cf.total)*100):0;
      document.getElementById('crowdFavMeta').textContent=`${cf.votes} of ${cf.total} watcher vote${cf.total===1?'':'s'} (${pct}%)`;
      cfBox.style.display='flex';
    } else if(cfBox){
      cfBox.style.display='none';
    }
    const rays=document.querySelector('.win-rays'), spot=document.querySelector('.win-spot');
    if(rays) rays.style.display=iWon?'':'none';
    if(spot) spot.style.display=iWon?'':'none';
    document.getElementById('winov').classList.add('show');
    const g=window.gsap, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(g && !reduced){
      _playWinSeq(iWon, finalCoins);
    } else {
      coinsEl.textContent=(finalCoins>=0?'+':'')+finalCoins+' 🪙';
      if(iWon){ confetti(); SFX.play('win'); } else SFX.play('error');
    }
  }
  // Cinematic victory sequence — anticipation, slam, shake, confetti, coins.
  function _playWinSeq(iWon, coins){
    const g=window.gsap;
    const ov=document.getElementById('winov'), content=document.getElementById('winContent');
    const wt=document.getElementById('wtitle'), coinsEl=document.getElementById('wcoins');
    const reward=['wdet','wcoins','wbet'].map(id=>document.getElementById(id))
      .concat([document.getElementById('mvpBadge'),document.getElementById('crowdFav'),ov.querySelector('.win-back')])
      .filter(el=>el && el.style.display!=='none');
    g.killTweensOf([ov,content,wt,'.win-rays','.win-spot']);
    const tl=g.timeline();
    tl.fromTo(ov,{opacity:0},{opacity:1,duration:.28,ease:'power1.out'});
    if(iWon){
      tl.fromTo('.win-spot',{scale:0,opacity:0},{scale:1,opacity:1,duration:.7,ease:'power2.out'},0)
        .fromTo('.win-rays',{scale:.4,opacity:0},{scale:1,opacity:1,duration:1,ease:'power2.out'},0)
        .fromTo(wt,{scale:2.7,opacity:0,filter:'blur(10px)'},
          {scale:1,opacity:1,filter:'blur(0px)',duration:.5,ease:'back.out(1.7)',
           onComplete:()=>g.set(wt,{clearProps:'transform,filter,opacity'})},.16)
        .call(()=>{ try{SFX.play('win');}catch(e){} confetti(); })
        .fromTo(content,{x:-11},{x:11,duration:.05,repeat:5,yoyo:true,ease:'none',clearProps:'x'},'>-0.03')
        .call(()=>{ _winCoinCount(coinsEl,coins); if(coins>0) _coinBurst(coinsEl); })
        .fromTo(reward,{y:26,opacity:0},{y:0,opacity:1,duration:.5,stagger:.09,ease:'power3.out'},'>-0.12');
    } else {
      coinsEl.textContent=(coins>=0?'+':'')+coins+' 🪙';
      tl.fromTo(content,{y:26,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},0);
      try{ SFX.play('error'); }catch(e){}
    }
  }
  function _winCoinCount(el,target){
    const g=window.gsap, sign=target<0?'-':'+', abs=Math.abs(target), o={v:0};
    g.to(o,{v:abs,duration:1.15,ease:'power2.out',
      onUpdate:()=>{ el.textContent=sign+Math.round(o.v).toLocaleString()+' 🪙'; },
      onComplete:()=>{ el.textContent=sign+abs.toLocaleString()+' 🪙'; }});
  }
  function _coinBurst(originEl){
    const g=window.gsap;
    const r=originEl.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<18;i++){
      const c=document.createElement('div');
      c.className='win-coin-particle'; c.textContent='🪙';
      c.style.left=cx+'px'; c.style.top=cy+'px';
      document.body.appendChild(c);
      const ang=Math.random()*Math.PI*2, dist=130+Math.random()*240;
      g.to(c,{x:Math.cos(ang)*dist,y:Math.sin(ang)*dist-60-Math.random()*120,
        rotation:(Math.random()-.5)*620,scale:.5+Math.random()*1.1,
        duration:.95+Math.random()*.5,ease:'power3.out'});
      g.to(c,{opacity:0,duration:.45,delay:.6+Math.random()*.3,onComplete:()=>c.remove()});
    }
  }

  /* ═══ CLUTCH MOMENTS ═══
     Triggered when any player goes from 2+ cards to 1 card. We watch
     player handSize across state updates and fire a quick cinematic
     (full-screen flash, dramatic sting, slow-mo on the board). */
  const Clutch = {
    lastHands: {},
    lastFiredAt: 0,
    check(players){
      if(!players || S.isSpectator===false && !S.roomId) return;
      const now = Date.now();
      players.forEach(p => {
        const prev = this.lastHands[p.id];
        if (prev !== undefined && prev > 1 && p.handSize === 1 && now - this.lastFiredAt > 1500) {
          this.lastFiredAt = now;
          this.fire(p);
        }
        this.lastHands[p.id] = p.handSize;
      });
    },
    reset(){ this.lastHands = {}; this.lastFiredAt = 0; },
    fire(player){
      const ov = document.getElementById('clutchOv');
      const nameEl = document.getElementById('clutchName');
      if (!ov || !nameEl) return;
      nameEl.textContent = (player.username || 'PLAYER').toUpperCase();
      // Dramatic synth sting (3-note rising chord)
      try {
        if (typeof soundOn === 'undefined' || soundOn) {
          SFX.init();
          const c = SFX.ctx, now = c.currentTime;
          [261.63, 392.00, 523.25].forEach((freq, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.value = freq;
            o.connect(g); g.connect(c.destination);
            const t = now + i * 0.08;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.16, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
            o.start(t); o.stop(t + 0.6);
          });
        }
      } catch(e) {}
      document.body.classList.add('clutch');
      ov.classList.add('show');
      const txt = document.getElementById('clutchTxt');
      txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = '';
      setTimeout(() => {
        ov.classList.remove('show');
        document.body.classList.remove('clutch');
      }, 1100);
    }
  };
  function backLobby(){
    document.getElementById('winov').classList.remove('show');
    // Tell the server we're leaving the (already finished) room so it stops
    // routing any lingering events to us, then go to lobby
    if(S.roomId && S.socket){
      S.socket.emit('room:leave',{},()=>{ S.roomId=null; goLobby(); });
    } else {
      S.roomId=null; goLobby();
    }
  }

  function confetti(){
    const cols=['#E8324A','#F59E0B','#16A34A','#2563EB','#7C3AED','#EC4899','#06B6D4','#fff'];
    const cvs=document.createElement('canvas');
    cvs.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:160';
    document.body.appendChild(cvs);cvs.width=innerWidth;cvs.height=innerHeight;
    const ctx=cvs.getContext('2d');
    const ps=Array.from({length:200},()=>{
      const type=Math.random();
      return{x:Math.random()*cvs.width,y:-30-Math.random()*200,
        w:type<.3?3:8+Math.random()*12,h:type<.3?12:4+Math.random()*8,
        c:cols[~~(Math.random()*cols.length)],
        r:Math.random()*Math.PI*2,rs:(Math.random()-.5)*.2,
        sp:1.5+Math.random()*4,dr:(Math.random()-.5)*2.5,
        swing:Math.random()*Math.PI*2,swingSpeed:.02+Math.random()*.03};
    });
    const t0=Date.now();
    (function draw(){ctx.clearRect(0,0,cvs.width,cvs.height);ps.forEach(p=>{
      p.y+=p.sp;p.x+=p.dr+Math.sin(p.swing)*1.5;p.swing+=p.swingSpeed;p.r+=p.rs;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);
      ctx.globalAlpha=Math.min(1,Math.max(0,1-(p.y/cvs.height)));
      ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });if(Date.now()-t0<6000)requestAnimationFrame(draw);else cvs.remove();})();
  }

  /* ═══ GAME PARTICLES ═══ */
  function initGameParticles(){
    AnimLayer.init();
    const c=document.getElementById('gameParticles');c.innerHTML='';
    for(let i=0;i<20;i++){
      const p=document.createElement('div');p.className='game-particle';
      p.style.cssText=`left:${Math.random()*100}%;animation-delay:${Math.random()*12}s;animation-duration:${10+Math.random()*8}s;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;`;
      c.appendChild(p);
    }
  }

  /* ═══ BACKGROUND ═══ */
  function buildBg(){
    const bg=document.getElementById('auth-bg');
    const cols=['#E8324A','#2563EB','#16A34A','#F59E0B','#7C3AED'];
    for(let i=0;i<16;i++){
      const d=document.createElement('div');d.className='auth-bg-card';
      d.style.cssText=`left:${Math.random()*90}%;top:${Math.random()*90}%;background:${cols[i%cols.length]};--r:${(Math.random()-.5)*40}deg;transform:rotate(var(--r));animation-delay:${Math.random()*5}s;animation-duration:${7+Math.random()*6}s;`;
      bg.appendChild(d);
    }
  }

  /* ═══ CINEMATIC LOBBY — 3D cards, parallax, UI sounds ═══ */
  // GSAP cinematic lobby intro — camera zoom, lights, orchestrated panels.
  function playLobbyIntro(){
    const g=window.gsap;
    const scr=document.getElementById('lobby-screen');
    if(!g||!scr) return;                       // no GSAP → CSS entrance plays
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    scr.classList.add('intro-gsap');           // hand entrance over to GSAP
    g.killTweensOf([scr,'.lhdr','.lobby-hero','.lside-section','.lrail .rail-panel','.lnav','.lobby-bg-img','.lobby-3d','.lobby-fx']);
    const tl=g.timeline({defaults:{ease:'power3.out'},
      onComplete:()=>g.set(scr,{clearProps:'transform'})});
    tl.fromTo(scr,{scale:1.05},{scale:1,duration:1.2,ease:'power2.out'},0)
      .fromTo(['.lobby-bg-img','.lobby-3d','.lobby-fx'],{opacity:0},{opacity:1,duration:.9,stagger:.08},0)
      .fromTo('.lhdr',{y:-54,opacity:0},{y:0,opacity:1,duration:.6,ease:'back.out(1.4)'},.12)
      .fromTo('.lobby-hero',{y:34,opacity:0,scale:.96},{y:0,opacity:1,scale:1,duration:.7},.28)
      .fromTo('.lside-section',{x:-34,opacity:0},{x:0,opacity:1,duration:.5,stagger:.09},.4)
      .fromTo(['.lmain .public-title','.lmain .public-info'],{y:18,opacity:0},{y:0,opacity:1,duration:.5,stagger:.07},.5)
      .fromTo('.lrail .rail-panel',{x:40,opacity:0},{x:0,opacity:1,duration:.55,stagger:.1},.55)
      .fromTo('.lnav',{y:64,opacity:0},{y:0,opacity:1,duration:.6,ease:'back.out(1.5)'},.7);
  }

  function buildLobby3D(){
    const host=document.getElementById('lobby3d');
    if(!host||host.childElementCount) return;
    const cols=[['#FF5577','#9B1B2E'],['#FBBF24','#92400E'],['#34D399','#14532D'],
                ['#60A5FA','#1E3A8A'],['#A78BFA','#4C1D95'],['#F472B6','#9D174D']];
    const vals=['7','+2','★','4','↺','+4','9','3','6'];
    const X=[7,23,41,61,81,91,15,49,73], Y=[15,63,29,71,19,52,84,8,42];
    const rot=[-18,22,-12,16,-26,12,-8,28,-15];
    const rx=[10,-8,14,-12,8,-14,12,-6,10], ry=[-16,20,-10,18,-22,14,-12,24,-14];
    for(let i=0;i<9;i++){
      const c=cols[i%cols.length];
      const card=document.createElement('div');
      card.className='l3d-card';
      card.style.cssText=`left:${X[i]}%;top:${Y[i]}%;`+
        `--rot:${rot[i]}deg;--rx:${rx[i]}deg;--ry:${ry[i]}deg;`+
        `--dur:${19+i*2.3}s;--delay:${(i*-2.7).toFixed(1)}s;`+
        `--op:${(0.30+(i%3)*0.16).toFixed(2)};`;
      card.innerHTML=`<div class="l3d-inner" style="--c1:${c[0]};--c2:${c[1]}"><span>${vals[i]}</span><div class="l3d-shine"></div></div>`;
      host.appendChild(card);
    }
  }
  let _lobbyFxInit=false;
  function initLobbyFx(){
    if(_lobbyFxInit) return; _lobbyFxInit=true;
    const layer=document.getElementById('lobby3d');
    const scr=document.getElementById('lobby-screen');
    // keep the floating-dock pill aligned when the viewport resizes
    let _lnavRz; window.addEventListener('resize',()=>{ clearTimeout(_lnavRz); _lnavRz=setTimeout(_initLnav,120); },{passive:true});
    // Mouse parallax — soft camera drift on the floating cards
    if(layer&&scr&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
      let tx=0,ty=0,cx=0,cy=0,raf=null;
      const loop=()=>{
        cx+=(tx-cx)*0.07; cy+=(ty-cy)*0.07;
        layer.style.transform=`translate3d(${(-cx*32).toFixed(1)}px,${(-cy*30).toFixed(1)}px,0)`;
        raf=(Math.abs(tx-cx)>5e-4||Math.abs(ty-cy)>5e-4)?requestAnimationFrame(loop):null;
      };
      scr.addEventListener('pointermove',e=>{
        tx=e.clientX/innerWidth-0.5; ty=e.clientY/innerHeight-0.5;
        if(!raf) raf=requestAnimationFrame(loop);
      },{passive:true});
    }
    // World chat — send on Enter
    const wi=document.getElementById('worldInput');
    if(wi) wi.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendWorld(); } });
    // UI hover / click sounds — soft and debounced
    const SEL='.lbtn,.btnA,.btnP,.btnS,.btnI,.rcard,.rtable,.cat-opt,.coin-pill-hdr,#huser,.game-menu-item';
    document.addEventListener('pointerover',e=>{
      const el=e.target.closest&&e.target.closest(SEL);
      if(el&&!el._hv){ el._hv=1; SFX.play('hover'); setTimeout(()=>{el._hv=0;},140); }
    },{passive:true});
    document.addEventListener('click',e=>{
      if(e.target.closest&&e.target.closest(SEL)) SFX.play('click');
    },{passive:true});
    // 3D pointer-tilt on room tables — real depth on hover
    if(!matchMedia('(pointer:coarse)').matches){
      document.addEventListener('pointermove',e=>{
        const card=e.target.closest&&e.target.closest('.rcard,.rtable');
        if(!card) return;
        const r=card.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-0.5, py=(e.clientY-r.top)/r.height-0.5;
        card.style.transform=`perspective(820px) rotateX(${(-py*9).toFixed(2)}deg) rotateY(${(px*12).toFixed(2)}deg) translateY(-10px)`;
      },{passive:true});
      document.addEventListener('pointerout',e=>{
        const card=e.target.closest&&e.target.closest('.rcard,.rtable');
        if(card&&!card.contains(e.relatedTarget)) card.style.transform='';
      },{passive:true});
    }
  }

  /* ═══ CARD ANIMATIONS ENGINE ═══ */
  const AnimLayer = {
    el: null,
    init(){ this.el = document.getElementById('cardAnimLayer'); },

    _cardColor(card){
      if(!card) return 'back';
      if(card.color === 'wild' || !card.color) return 'wild';
      return card.color;
    },

    _cardLabel(card){
      if(!card) return '';
      const v = card.value||'';
      const map = {skip:'⊘',reverse:'↺',draw_two:'+2',wild_draw_four:'+4',wild:'★'};
      return map[v] || v.toUpperCase();
    },

    // Deal: cards arc from the deck into the player's hand with impact.
    deal(count = 7, targetEl){
      if(!this.el || !targetEl) return;
      const g = window.gsap;
      const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
      const tr = targetEl.getBoundingClientRect();
      const deck = document.getElementById('drawpile');
      const dr = deck ? deck.getBoundingClientRect()
                      : {left:innerWidth/2-37,top:innerHeight/2-55,width:74,height:110};
      const sx = dr.left + dr.width/2, sy = dr.top + dr.height/2;
      const n = Math.min(count, 12);
      if(g && !reduced){
        for(let i=0;i<n;i++){
          const c = document.createElement('div');
          c.className = 'anim-card back';
          c.style.cssText = `left:${sx-37}px;top:${sy-55}px;opacity:0;will-change:transform,opacity;`;
          this.el.appendChild(c);
          const slotX = tr.left + tr.width * (n>1 ? 0.16 + 0.68*(i/(n-1)) : 0.5);
          const tx = slotX - sx;
          const ty = (tr.top + tr.height*0.42) - sy;
          const apexY = ty - (88 + Math.random()*54);     // arc apex above the hand
          const rot = Math.random()*26 - 13;
          g.timeline({delay:i*0.072})
            .set(c,{opacity:1})
            .to(c,{keyframes:[
              {x:tx*0.5, y:apexY, rotation:rot*0.5, scale:1.14, duration:0.22, ease:'power2.out'},
              {x:tx, y:ty+9, rotation:rot, scale:0.99, duration:0.2, ease:'power2.in'}
            ]},0)
            .to(c,{y:ty, scale:1, duration:0.22, ease:'back.out(3)',
              onStart:()=>{ if(i%2===0){ try{SFX.play('draw');}catch(e){} } }})
            .to(c,{opacity:0, duration:0.16, delay:0.06, onComplete:()=>c.remove()});
        }
        if(deck) g.fromTo(deck,{scale:1},{scale:0.93,duration:0.1,yoyo:true,repeat:1,
          ease:'power1.inOut',transformOrigin:'50% 100%',clearProps:'scale'});
        return;
      }
      // Fallback (no GSAP / reduced motion): simple flight
      for(let i=0;i<n;i++){
        setTimeout(()=>{
          const c=document.createElement('div');
          c.className='anim-card back';
          c.style.cssText=`left:${sx-37}px;top:${sy-55}px;`;
          const tx=tr.left+tr.width/2-sx, ty=tr.top+tr.height/2-sy;
          c.animate([
            {transform:'translate(0,0) scale(.6)',opacity:0},
            {transform:`translate(${tx}px,${ty}px) scale(1)`,opacity:1,offset:.75},
            {transform:`translate(${tx}px,${ty}px) scale(1)`,opacity:0}
          ],{duration:600,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
          this.el.appendChild(c);
          setTimeout(()=>c.remove(),650);
        }, i*55);
      }
    },

    // Play: card flies from hand to center pile
    play(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight*.8,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${this._cardColor(card)}`;
      c.textContent = this._cardLabel(card);
      c.style.cssText=`left:${from.left+from.width/2-37}px;top:${from.top+from.height/2-55}px;`;
      c.animate([
        {transform:'scale(1) rotate(0)',opacity:1},
        {transform:'scale(1.35) translateY(-40px) rotate(-6deg)',opacity:1,offset:.35},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1) rotate(0)`,opacity:1,offset:.8},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.95) rotate(0)`,opacity:1}
      ],{duration:480,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      this.el.appendChild(c);
      setTimeout(()=>c.remove(),600);
      // float label
      this._floatLabel(card, to);
    },

    // Draw: card pops into hand from deck
    draw(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight*.85,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${card?this._cardColor(card):'back'} draw-anim-card`;
      c.textContent = card ? this._cardLabel(card) : '';
      c.style.cssText=`left:${from.left+from.width/2-37}px;top:${from.top+from.height/2-55}px;`;
      c.animate([
        {transform:'scale(.6) rotate(15deg)',opacity:0},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1.1) rotate(-3deg)`,opacity:1,offset:.7},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1) rotate(0)`,opacity:1}
      ],{duration:500,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
      this.el.appendChild(c);
      setTimeout(()=>c.remove(),650);
    },

    // Draw many: stagger N face-down cards flying from deck to target panel/hand
    drawMany(count, fromEl, toEl, opts = {}){
      if(!this.el || !count) return;
      const stagger = opts.stagger ?? 110;
      const duration = opts.duration ?? 520;
      const total = Math.min(count, 12);
      try{ SFX?.play && SFX.play('draw'); }catch(e){}
      const from0 = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight/2,width:80,height:120};
      const to0   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight*.5,width:80,height:120};
      for(let i=0;i<total;i++){
        setTimeout(()=>{
          const fromEl2 = fromEl?.getBoundingClientRect ? fromEl.getBoundingClientRect() : from0;
          const toEl2 = toEl?.getBoundingClientRect ? toEl.getBoundingClientRect() : to0;
          const c = document.createElement('div');
          c.className = 'anim-card back';
          const startX = fromEl2.left + fromEl2.width/2 - 37;
          const startY = fromEl2.top + fromEl2.height/2 - 55;
          c.style.cssText = `left:${startX}px;top:${startY}px;`;
          const dx = toEl2.left + toEl2.width/2 - (startX+37);
          const dy = toEl2.top + toEl2.height/2 - (startY+55);
          const rot = (Math.random()*30 - 15);
          c.animate([
            {transform:'scale(.5) rotate(0deg)',opacity:0},
            {transform:`translate(${dx*.45}px,${dy*.45}px) scale(1.15) rotate(${rot/2}deg)`,opacity:1,offset:.4},
            {transform:`translate(${dx}px,${dy}px) scale(1) rotate(${rot}deg)`,opacity:1,offset:.85},
            {transform:`translate(${dx}px,${dy}px) scale(.85) rotate(${rot}deg)`,opacity:0}
          ],{duration,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
          this.el.appendChild(c);
          setTimeout(()=>c.remove(), duration + 100);
          if(opts.onLand) try{opts.onLand(i,total)}catch(e){}
        }, i*stagger);
      }
    },

    // Opponent plays: card appears above opponent panel then flies to pile
    opponentPlay(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:80,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${this._cardColor(card)}`;
      c.textContent = this._cardLabel(card);
      c.style.cssText=`left:${from.left+from.width/2-37}px;top:${from.top+from.height/2-55}px;`;
      c.animate([
        {transform:'scale(.4) rotate(-20deg)',opacity:0},
        {transform:'scale(1.2) rotate(3deg)',opacity:1,offset:.4},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1) rotate(0)`,opacity:1}
      ],{duration:600,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
      this.el.appendChild(c);
      setTimeout(()=>c.remove(),750);
      this._floatLabel(card, to);
    },

    _floatLabel(card, pos){
      if(!card||!this.el) return;
      const v = card.value||'';
      const special = {skip:'⊘ SKIP',reverse:'↺ REVERSE',draw_two:'⚡ +2',wild_draw_four:'💥 +4',wild:'★ WILD'};
      const txt = special[v];
      if(!txt) return;
      const lbl = document.createElement('div');
      lbl.className='float-label';
      lbl.style.cssText=`left:${pos.left+pos.width/2-60}px;top:${pos.top-10}px;color:#F59E0B;`;
      lbl.textContent=txt;
      this.el.appendChild(lbl);
      setTimeout(()=>lbl.remove(),950);
    }
  };
  /* ═══ ENTER KEY for auth ═══ */
  /* ═══ EMOJI REACTIONS ═══ */
  function toggleEmojiPicker(){
    document.getElementById('emojiPicker').classList.toggle('show');
  }

  const EMOJI_COOLDOWN_MS = 5000;
  let _emojiNextAt = 0;
  let _emojiCooldownTimer = null;

  function _getCardAreaCenter(){
    const top = document.getElementById('topcard');
    const r = top?.getBoundingClientRect();
    if(r && r.width){
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return { x: window.innerWidth/2, y: window.innerHeight/2 };
  }

  function _renderEmojiCooldown(remainingMs){
    const picker = document.getElementById('emojiPicker');
    if(!picker) return;
    const existing = picker.querySelector('.cooling-label');
    if(remainingMs <= 0){
      picker.classList.remove('cooling');
      if(existing) existing.remove();
      return;
    }
    picker.classList.add('cooling');
    const txt = `⏳ Wait ${Math.ceil(remainingMs/1000)}s`;
    if(existing){existing.textContent = txt;return;}
    const lbl = document.createElement('div');
    lbl.className='cooling-label';lbl.textContent=txt;
    picker.appendChild(lbl);
  }

  function sendReaction(emoji){
    if(!S.socket||!S.roomId) return;
    const now = Date.now();
    const remaining = _emojiNextAt - now;
    if(remaining > 0){
      toast(`⏳ Wait ${Math.ceil(remaining/1000)}s before next emoji`,'i');
      _renderEmojiCooldown(remaining);
      return;
    }
    document.getElementById('emojiPicker').classList.remove('show');
    const center = _getCardAreaCenter();
    showReactionFly(emoji, center.x, center.y, true);
    S.socket.emit('game:reaction',{emoji});
    _emojiNextAt = now + EMOJI_COOLDOWN_MS;
    _renderEmojiCooldown(EMOJI_COOLDOWN_MS);
    if(_emojiCooldownTimer) clearInterval(_emojiCooldownTimer);
    _emojiCooldownTimer = setInterval(()=>{
      const left = _emojiNextAt - Date.now();
      _renderEmojiCooldown(left);
      if(left <= 0){clearInterval(_emojiCooldownTimer);_emojiCooldownTimer=null;}
    }, 250);
  }

  function showReactionFly(emoji, x, y, isMine){
    const el = document.createElement('div');
    el.className='reaction-fly';
    el.textContent=emoji;
    el.style.cssText=`left:${x-21}px;top:${y-21}px;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1700);
  }

  function showReactionOnPanel(emoji, playerId){
    const panel = document.querySelector(`.opanel[data-pid="${playerId}"]`);
    if(panel){
      const badge = document.createElement('div');
      badge.className='reaction-badge';
      badge.textContent=emoji;
      panel.style.position='relative';
      panel.appendChild(badge);
      setTimeout(()=>badge.remove(),2100);
    }
    const center = _getCardAreaCenter();
    showReactionFly(emoji, center.x, center.y, false);
  }

  /* ═══ PRIVATE ROOM CODE ═══ */
  function showJoinByCode(){
    document.getElementById('joinCodeInput').value='';
    document.getElementById('joinCodeErr').textContent='';
    document.getElementById('joinCodeModal').classList.add('show');
    setTimeout(()=>document.getElementById('joinCodeInput').focus(),100);
  }

  async function doJoinByCode(){
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    if(code.length !== 6) return document.getElementById('joinCodeErr').textContent='Enter 6 characters';
    document.getElementById('joinCodeErr').textContent='';
    try{
      const res = await apiFetch(`/api/rooms/code/${code}`);
      document.getElementById('joinCodeModal').classList.remove('show');
      doJoinRoom(res.roomId);
    } catch(e){
      document.getElementById('joinCodeErr').textContent = e.message||'Room not found';
    }
  }

  function showRoomCode(code){
    if(!code) return;
    S.roomCode = code;
    document.getElementById('roomCodeBox').style.display='block';
    document.getElementById('roomCodeDisplay').textContent = code;
  }

  function copyRoomCode(){
    if(!S.roomCode) return;
    navigator.clipboard.writeText(S.roomCode).then(()=>toast('Code copied!','s'));
  }

  /* ═══ FRIENDS SYSTEM ═══ */
  const Friends = {
    list: [], requests: [], tab: 'friends', open: false,
    pendingInvite: null,
  };

  function toggleFriendsPanel(){
    Friends.open = !Friends.open;
    document.getElementById('friendsPanel').classList.toggle('open', Friends.open);
    if(Friends.open) loadFriends();
  }

  function switchFriendsTab(tab){
    Friends.tab = tab;
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`ftab-${tab}`).classList.add('active');
    renderFriendsList();
  }

  async function loadFriends(){
    try{
      const data = await apiFetch('/api/friends');
      Friends.list = data.friends || [];
      // load requests from user object
      const me = await apiFetch('/api/auth/me');
      const reqs = me.user?.friendRequests || [];
      Friends.requests = reqs.map(id => {
        const u = [...(window._usersCache||[])].find(u=>u.id===id);
        return { id, username: u?.username || id };
      });
      renderFriendsList();
    } catch(e){ console.log('Friends load error', e); }
  }

  function renderFriendsList(){
    const el = document.getElementById('friendsList');
    if(!el) return;
    if(Friends.tab === 'friends'){
      if(!Friends.list.length){
        el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px;">No friends yet 😢<br>Add someone by username!</div>';
        return;
      }
      el.innerHTML = Friends.list.map(f => `
        <div class="friend-row">
          <div class="friend-dot ${f.isOnline?'online':'offline'}"></div>
          <div class="friend-name">${esc(f.username)}<br><span style="font-size:10px;color:var(--muted)">${f.isOnline?'Online':'Offline'}</span></div>
          ${S.roomId && f.isOnline ? `<button class="friend-action invite" onclick="doInviteFriend('${f.id}')">Invite</button>` : ''}
          <button class="friend-action decline" onclick="doRemoveFriend('${f.id}')">✕</button>
        </div>
      `).join('');
    } else {
      const reqEl = document.getElementById('reqCount');
      if(reqEl) reqEl.textContent = Friends.requests.length ? ` (${Friends.requests.length})` : '';
      if(!Friends.requests.length){
        el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px;">No pending requests</div>';
        return;
      }
      el.innerHTML = Friends.requests.map(r => `
        <div class="friend-row">
          <div class="friend-name">👤 ${esc(r.username)}</div>
          <button class="friend-action accept" onclick="doAcceptFriend('${r.id}')">✓ Accept</button>
          <button class="friend-action decline" onclick="doDeclineFriend('${r.id}')">✕</button>
        </div>
      `).join('');
    }
  }

  async function doAddFriend(){
    const username = document.getElementById('addFriendInput').value.trim();
    if(!username) return;
    try{
      await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify({ username }) });
      document.getElementById('addFriendInput').value = '';
      toast(`Friend request sent to ${username}!`, 's');
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doAcceptFriend(userId){
    try{
      await apiFetch('/api/friends/accept', { method:'POST', body: JSON.stringify({ userId }) });
      toast('Friend added! 🎉', 's');
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doDeclineFriend(userId){
    try{
      await apiFetch('/api/friends/decline', { method:'POST', body: JSON.stringify({ userId }) });
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doRemoveFriend(userId){
    try{
      await apiFetch('/api/friends/remove', { method:'POST', body: JSON.stringify({ userId }) });
      toast('Friend removed', 'i');
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doInviteFriend(friendId){
    if(!S.roomId) return toast('You are not in a room', 'e');
    try{
      await apiFetch('/api/friends/invite', { method:'POST', body: JSON.stringify({ friendId, roomId: S.roomId }) });
      toast('Invite sent! 🎮', 's');
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  function showInviteToast(from, roomId, code){
    Friends.pendingInvite = { roomId, code };
    document.getElementById('inviteToastTitle').textContent = `🎮 ${from.username} invited you!`;
    document.getElementById('inviteToastMsg').textContent = code ? `Room Code: ${code}` : '';
    document.getElementById('inviteAcceptBtn').onclick = () => {
      hideInviteToast();
      doJoinRoom(roomId);
    };
    document.getElementById('inviteToast').classList.add('show');
    setTimeout(hideInviteToast, 15000);
  }

  function hideInviteToast(){
    document.getElementById('inviteToast').classList.remove('show');
  }

  function updateFriendsNotif(count){
    const el = document.getElementById('friendsNotif');
    if(!el) return;
    el.textContent = count;
    el.classList.toggle('show', count > 0);
  }

  /* ═══ RANKED / ELO ═══ */
  const LEAGUES = [
    { name:'Bronze',  min:0,    max:999,  badge:'🥉', color:'#CD7F32' },
    { name:'Silver',  min:1000, max:1499, badge:'🥈', color:'#C0C0C0' },
    { name:'Gold',    min:1500, max:1999, badge:'🥇', color:'#FFD700' },
    { name:'Diamond', min:2000, max:9999, badge:'💎', color:'#B9F2FF' },
  ];

  function getLeague(elo){
    return [...LEAGUES].reverse().find(l => elo >= l.min) || LEAGUES[0];
  }

  function leagueBadgeHTML(elo){
    const l = getLeague(elo||1000);
    return `<span class="league-badge" style="color:${l.color};border-color:${l.color}40">${l.badge} ${l.name}</span>`;
  }

  function eloBarHTML(elo){
    const l = getLeague(elo||1000);
    const next = LEAGUES.find(lg => lg.min > (elo||1000));
    const pct = next ? Math.round(((elo-l.min)/(next.min-l.min))*100) : 100;
    return `
      <div class="elo-bar-wrap">
        <div class="elo-bar-label"><span>${l.badge} ${l.name}</span><span>${elo||1000} ELO${next?` / ${next.min}`:' MAX'}</span></div>
        <div class="elo-bar"><div class="elo-bar-fill" style="width:${pct}%;background:${l.color}"></div></div>
      </div>`;
  }

  async function showRankedLb(){
    try{
      const data = await apiFetch('/api/leaderboard/ranked');
      const list = data.leaderboard || [];
      const myId = S.user?.id;
      document.getElementById('rankedLbList').innerHTML = list.map(r => `
        <div class="ranked-row ${r.username===S.user?.username?'me':''}">
          <div class="ranked-rank ${r.rank===1?'gold':r.rank===2?'silver':r.rank===3?'bronze':''}">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</div>
          <div class="ranked-name">${esc(r.username)}<br><span style="font-size:10px;color:var(--muted)">${r.badge} ${r.league}</span></div>
          <div class="ranked-elo">${r.elo}</div>
        </div>
      `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">No ranked games yet</div>';
      document.getElementById('rankedLbOv').classList.add('show');
    } catch(e){ toast('Could not load ranked leaderboard','e'); }
  }

  function showEloPopup(change, won){
    const el = document.createElement('div');
    el.className = 'elo-popup';
    el.style.color = won ? '#4ade80' : '#f87171';
    el.textContent = (won?'+':'-') + Math.abs(change) + ' ELO';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 2600);
  }

  /* ═══ TOURNAMENTS ═══ */
  const Tourn = { current: null, pendingMatch: null, filter: 'all', expanded: null, lastList: [] };

  async function showTournaments(){
    document.getElementById('tournOv').classList.add('show');
    _renderTournamentsList([], true); // loading state
    try{
      const data = await apiFetch('/api/tournaments');
      _renderTournamentsList(data.tournaments || [], false);
    } catch(e){
      _renderTournamentsList([], false, 'Could not load tournaments');
    }
  }
  function _renderTournamentsList(rawList, loading, errMsg){
    const box = document.querySelector('#tournOv .tourn-box');
    if(!box) return;
    Tourn.lastList = rawList || [];
    const me = S.user?.id;
    const filter = Tourn.filter || 'all';
    const list = (rawList || []).filter(t => {
      if(filter==='open')    return t.status==='open';
      if(filter==='playing') return t.status==='playing';
      if(filter==='mine')    return t.creatorId === me || t.players.find(p=>p.id===me);
      return true;
    });
    const counts = {
      all: (rawList||[]).length,
      open: (rawList||[]).filter(t=>t.status==='open').length,
      playing: (rawList||[]).filter(t=>t.status==='playing').length,
      mine: (rawList||[]).filter(t=>t.creatorId===me||t.players.find(p=>p.id===me)).length,
    };
    let body;
    if(loading){
      body = `<div class="t-loading"><div class="t-spinner"></div>Loading tournaments…</div>`;
    } else if(errMsg){
      body = `<div style="text-align:center;color:#f87171;padding:40px;font-weight:700">${esc(errMsg)}</div>`;
    } else if(!list.length){
      const emptyMsg = filter==='mine' ? 'You haven\'t joined or hosted any tournament yet.'
                      : filter==='open' ? 'No open tournaments — be the first to host one!'
                      : filter==='playing' ? 'Nothing playing right now.'
                      : 'No tournaments yet. Create the first one!';
      body = `<div class="t-empty">
        <div class="t-empty-icon">🏆</div>
        <div class="t-empty-title">Nothing here</div>
        <div class="t-empty-sub">${emptyMsg}</div>
      </div>`;
    } else {
      body = `<div class="t-list">${list.map(t=>_tournamentCardHTML(t)).join('')}</div>`;
    }
    const tab = (k,lbl) => `<button class="t-tab ${filter===k?'on':''}" onclick="_setTournFilter('${k}')">${lbl}<span class="t-tab-n">${counts[k]}</span></button>`;
    box.innerHTML = `
      <div class="t-head">
        <div class="tourn-title">🏆 TOURNAMENTS</div>
        <button class="t-close" onclick="document.getElementById('tournOv').classList.remove('show')">✕</button>
      </div>
      <button class="t-create-btn" onclick="showCreateTournamentModal()">＋ Create Tournament</button>
      <div class="t-tabs">
        ${tab('all','All')}${tab('open','Open')}${tab('playing','Playing')}${tab('mine','Mine')}
      </div>
      ${body}
    `;
  }
  function _setTournFilter(f){
    Tourn.filter = f;
    _renderTournamentsList(Tourn.lastList || [], false);
  }
  function _toggleTournBracket(id){
    Tourn.expanded = Tourn.expanded === id ? null : id;
    _renderTournamentsList(Tourn.lastList || [], false);
  }
  function _tournamentCardHTML(t){
    const me = S.user?.id;
    const registered = !!t.players.find(p=>p.id===me);
    const isCreator = t.creatorId === me;
    const isFull = t.players.length >= t.maxPlayers;
    const expanded = Tourn.expanded === t.id;
    const statusBadge = t.status==='open'
      ? `<span class="t-status open">OPEN</span>`
      : t.status==='playing'
        ? `<span class="t-status playing">● ROUND ${t.round}</span>`
        : `<span class="t-status done">FINISHED</span>`;
    let action = '';
    if(t.status==='open'){
      if(isCreator && t.players.length>=2){
        action = `<button class="t-act t-act-start" onclick="event.stopPropagation();doStartTournament('${t.id}')">⚔️ Start Now${t.players.length<t.maxPlayers?' · fills bots':''}</button>`;
      } else if(registered){
        action = `<div class="t-act t-act-wait">✅ Registered — waiting</div>`;
      } else if(!isFull){
        const feeLbl = t.entryFee>0 ? ` · ${t.entryFee.toLocaleString()}🪙` : '';
        action = `<button class="t-act t-act-join" onclick="event.stopPropagation();doJoinTournamentId('${t.id}')">🏆 Register${feeLbl}</button>`;
      } else {
        action = `<div class="t-act t-act-wait">Tournament full</div>`;
      }
    } else if(t.status==='playing'){
      action = registered
        ? `<div class="t-act t-act-wait">⚔️ In progress — your match awaits</div>`
        : `<div class="t-act t-act-wait">⚔️ Round ${t.round} in progress</div>`;
    } else if(t.status==='finished'){
      action = `<div class="t-act t-act-wait">🏆 Champion: ${esc(t.winner?.username||'?')}</div>`;
    }
    const creator = t.creatorId ? (t.players.find(p=>p.id===t.creatorId)?.username || 'someone') : 'system';
    const pot = t.pot != null ? t.pot : t.prizeCoins;
    const feeBit = t.entryFee>0 ? `<div class="t-meta"><b>🎟️ ${t.entryFee.toLocaleString()}</b> fee</div>` : '';
    const bracketHTML = expanded ? _tournamentBracketHTML(t) : '';
    return `<div class="t-card ${expanded?'open':''}" onclick="_toggleTournBracket('${t.id}')">
      <div class="t-card-head">
        <div class="t-card-name">${esc(t.name)}</div>
        ${statusBadge}
      </div>
      <div class="t-card-meta">
        <div class="t-meta"><b>👥 ${t.players.length}/${t.maxPlayers}</b> players</div>
        <div class="t-meta"><b>🪙 ${pot.toLocaleString()}</b> pot</div>
        ${feeBit}
        <div class="t-meta">Host <b>${esc(creator)}</b></div>
      </div>
      ${action}
      ${bracketHTML}
      <div class="t-expand-hint">${expanded?'▴ Hide details':'▾ Show players & bracket'}</div>
    </div>`;
  }
  function _tournamentBracketHTML(t){
    const me = S.user?.id;
    const pChip = (p) => {
      if(!p) return '<div class="t-pchip empty">—</div>';
      const isBot = !!p.isBot;
      const isMe = p.id === me;
      return `<div class="t-pchip ${isMe?'me':''} ${isBot?'bot':''}">${esc(p.username)}${isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>`;
    };
    let bracketBlock = '';
    if(t.bracket?.length){
      bracketBlock = `<div class="t-bracket"><div class="t-bracket-title">Round ${t.round} Bracket</div>` +
        t.bracket.map(m => {
          const w = m.winner;
          const w1 = w && w===m.p1?.id, w2 = w && w===m.p2?.id;
          return `<div class="t-match">
            <div class="t-match-p ${w1?'win':w?'lose':''}">${esc(m.p1?.username||'?')}${m.p1?.isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>
            <div class="t-vs">VS</div>
            <div class="t-match-p ${w2?'win':w?'lose':''}">${esc(m.p2?.username||'?')}${m.p2?.isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>
          </div>`;
        }).join('') + '</div>';
    }
    const slots = Math.max(0, t.maxPlayers - t.players.length);
    const playersHTML = `<div class="t-bracket"><div class="t-bracket-title">Players (${t.players.length}/${t.maxPlayers})</div>
      <div class="t-pchips">${t.players.map(pChip).join('')}${Array(slots).fill('<div class="t-pchip empty">empty</div>').join('')}</div>
    </div>`;
    return `<div class="t-detail" onclick="event.stopPropagation()">${playersHTML}${bracketBlock}</div>`;
  }
  async function doJoinTournamentId(id){
    try{
      await apiFetch(`/api/tournaments/${id}/join`,{method:'POST'});
      toast('Registered! 🏆','s');
      showTournaments();
    }catch(e){ toast(e.message||'Could not join','e'); }
  }
  async function doStartTournament(id){
    try{
      const d=await apiFetch(`/api/tournaments/${id}/start`,{method:'POST',body:JSON.stringify({})});
      toast('Tournament started! ⚔️','s');
      showTournaments();
    }catch(e){ toast(e.message||'Could not start','e'); }
  }
  function showCreateTournamentModal(){
    const old=document.getElementById('createTournModal'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='createTournModal';
    ov.style.cssText='position:fixed;inset:0;z-index:1500;background:rgba(4,6,14,.85);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;animation:avFadeIn .25s ease';
    const coins=(S.user?.coins||0);
    ov.innerHTML=`
      <div style="width:min(420px,95vw);background:linear-gradient(180deg,rgba(30,34,60,.97),rgba(16,20,36,.99));border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:24px;box-shadow:0 40px 100px rgba(0,0,0,.75);animation:avPanelIn .4s cubic-bezier(.2,.9,.3,1.2)">
        <div style="font-family:'Bangers',cursive;font-size:26px;letter-spacing:2px;color:#fff;text-align:center;margin-bottom:4px">🏆 CREATE TOURNAMENT</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-bottom:18px;font-weight:600">Set the rules. Take the trophy.</div>
        <div class="fg"><label>Tournament Name</label><input id="ctName" type="text" placeholder="My UNO Cup" maxlength="30"/></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label>Max Players</label>
            <select id="ctMax" style="width:100%;padding:13px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;font-weight:700;outline:none;cursor:pointer">
              <option value="2">2 Players</option>
              <option value="4" selected>4 Players</option>
              <option value="8">8 Players</option>
              <option value="16">16 Players</option>
            </select>
          </div>
          <div class="fg"><label>Prize 🪙 <span class="fg-opt">staked</span></label><input id="ctPrize" type="number" min="0" max="${coins}" value="500" placeholder="0"/></div>
        </div>
        <div class="fg"><label>Entry Fee 🎟️ <span class="fg-opt">optional</span></label><input id="ctFee" type="number" min="0" value="0" placeholder="0"/></div>
        <div style="font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin:-4px 0 14px;line-height:1.55">You stake the prize (you have <b style="color:#FFD700">${coins.toLocaleString()}🪙</b>). Every player who joins pays the entry fee — it grows the pot. Empty slots fill with AI bots on start. <b style="color:#fff">Winner takes the full pot.</b></div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('createTournModal').remove()" style="flex:0 0 auto;padding:13px 22px;background:transparent;border:1.5px solid rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">Cancel</button>
          <button class="btnP" style="flex:1" onclick="doCreateTournament()">⚔️ Create</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    setTimeout(()=>document.getElementById('ctName')?.focus(),60);
  }
  async function doCreateTournament(){
    const name=document.getElementById('ctName').value.trim();
    const maxPlayers=parseInt(document.getElementById('ctMax').value,10);
    const prizeCoins=parseInt(document.getElementById('ctPrize').value,10)||0;
    const entryFee=parseInt(document.getElementById('ctFee').value,10)||0;
    if(name.length<3) return toast('Name must be at least 3 characters','e');
    try{
      const d=await apiFetch('/api/tournaments/create',{
        method:'POST',
        body:JSON.stringify({name, maxPlayers, prizeCoins, entryFee}),
      });
      if(S.user && typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        document.getElementById('hcoins').textContent=d.coins;
        document.getElementById('scoins').textContent=d.coins;
        const hc=document.getElementById('heroCoins'); if(hc) hc.textContent=d.coins.toLocaleString();
      }
      toast('🏆 Tournament created!','s');
      document.getElementById('createTournModal')?.remove();
      showTournaments();
    }catch(e){ toast(e.message||'Could not create','e'); }
  }

  function renderTournament(t){
    Tourn.current = t;
    document.getElementById('tournName').textContent = `🏆 ${t.name}`;
    document.getElementById('tournPrize').textContent = `🪙 Prize: ${t.prizeCoins.toLocaleString()} coins`;
    const isRegistered = t.players.find(p=>p.id===S.user?.id);
    const isFull = t.players.length >= t.maxPlayers;
    // Status
    const statusEl = document.getElementById('tournStatus');
    if(t.status==='open') statusEl.textContent = `${t.players.length}/${t.maxPlayers} players registered • Open for registration`;
    else if(t.status==='playing') statusEl.textContent = `🔥 Round ${t.round} in progress!`;
    else statusEl.textContent = `🏆 Finished! Winner: ${t.winner?.username||'?'}`;
    // Players
    document.getElementById('tournPlayersList').innerHTML = t.players.map(p=>`
      <div class="tourn-player-chip" style="${p.id===S.user?.id?'border-color:var(--accent);color:var(--accent)':''}">
        ${esc(p.username)}<br><span style="font-size:10px;color:var(--muted)">${leagueBadgeHTML(p.elo||1000)}</span>
      </div>
    `).join('') + (t.status==='open' ? Array(t.maxPlayers-t.players.length).fill('<div class="tourn-player-chip" style="opacity:.3;border-style:dashed">Empty</div>').join('') : '');
    // Bracket
    const bracketEl = document.getElementById('tournBracket');
    if(t.bracket?.length){
      bracketEl.innerHTML = `<div class="bracket-round"><div class="bracket-round-title">Round ${t.round}</div>` +
        t.bracket.map(m=>`
          <div class="bracket-match">
            <div class="bracket-player ${m.winner===m.p1.id?'winner':m.winner?'loser':t.status==='playing'?'playing':''}">${esc(m.p1.username)}</div>
            <div class="bracket-vs">VS</div>
            <div class="bracket-player ${m.winner===m.p2.id?'winner':m.winner?'loser':t.status==='playing'?'playing':''}">${esc(m.p2.username)}</div>
          </div>
        `).join('') + '</div>';
    } else bracketEl.innerHTML='';
    // Join button
    const joinWrap = document.getElementById('tournJoinWrap');
    if(t.status==='open' && !isRegistered && !isFull){
      joinWrap.innerHTML=`<button class="btnP" onclick="doJoinTournament()" style="width:100%">🏆 Register Now (Free)</button>`;
    } else if(isRegistered && t.status==='open'){
      joinWrap.innerHTML=`<div style="text-align:center;color:#4ade80;font-weight:700;padding:12px">✅ You are registered! Wait for the tournament to start.</div>`;
    } else joinWrap.innerHTML='';
  }

  async function doJoinTournament(){
    if(!Tourn.current) return;
    try{
      await apiFetch(`/api/tournaments/${Tourn.current.id}/join`, { method:'POST' });
      toast('Registered! 🏆 Good luck!','s');
      const data = await apiFetch(`/api/tournaments/${Tourn.current.id}`);
      renderTournament(data.tournament);
    } catch(e){ toast(e.message||'Error','e'); }
  }

  function doJoinMatch(){
    document.getElementById('matchInvite').classList.remove('show');
    if(Tourn.pendingMatch) doJoinRoom(Tourn.pendingMatch.roomId);
  }

  function handleAuthEnter(e){
    if(e.key!=='Enter')return;
    if(document.getElementById('lf')?.style.display!=='none')doLogin();
    else doRegister();
  }

  /* ═══ INIT ═══ */
  window.addEventListener('DOMContentLoaded',()=>{
    setLang(I18N.current); // apply saved language + RTL before anything renders
    buildBg();
    Theme.init();          // apply saved/seasonal lobby theme + atmosphere particles
    if(S.token&&S.user){initSock();goLobby();}
    else showScreen('auth-screen');
    // Auth enter key
    ['lu','lp','ru','rp'].forEach(id=>document.getElementById(id)?.addEventListener('keydown',handleAuthEnter));
  });

  document.addEventListener('keydown',e=>{
    const inGame=document.getElementById('game-screen').classList.contains('active');
    if(!inGame)return;
    if(e.code==='KeyU')doUNO();
    if(e.code==='Space'){e.preventDefault();doDraw();}
    if(e.code==='KeyC')doCancel();
  });

  /* ═══ PWA: Service Worker ═══ */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[PWA] SW registration failed:', e));
    });
  }
  /* Listen for the install prompt so we can offer it from the lobby gear menu later */
  window._pwaInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._pwaInstallPrompt = e;
  });
  function pwaInstall(){
    if(!window._pwaInstallPrompt) return toast('Already installed or not supported on this device','i');
    window._pwaInstallPrompt.prompt();
    window._pwaInstallPrompt.userChoice.then((c)=>{
      if(c.outcome==='accepted') toast('App installed! 🎉','s');
      window._pwaInstallPrompt = null;
    });
  }
  