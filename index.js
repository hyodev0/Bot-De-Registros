const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    Partials
} = require('discord.js');

const token = process.env.BOT_TOKEN || 'TOKE_DO_BOT';
const clientId = process.env.CLIENT_ID || 'ID_DO_BOT';
const guildId = process.env.GUILD_ID || 'ID_DO_SERVIDOR';
const roleId = process.env.ROLE_ID || 'ID_DO_CARGO_DE_VERIFICADO'; 
const logChannelId = process.env.LOG_CHANNEL_ID || 'ID_DO_CANAL_DE_LOGS';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.GuildMember]
});

const registrosFile = path.join(__dirname, 'registros.json');
let registros = {};

function carregarRegistros() {
    if (fs.existsSync(registrosFile)) {
        try {
            registros = JSON.parse(fs.readFileSync(registrosFile, 'utf-8'));
        } catch (e) {
            console.error('[ERRO] Falha ao ler registros.json:', e);
            registros = {};
        }
    }
}
carregarRegistros();

function salvarRegistros() {
    try {
        fs.writeFileSync(registrosFile, JSON.stringify(registros, null, 2));
    } catch (e) {
        console.error('[ERRO] Falha ao salvar registros.json:', e);
    }
}

async function logRegistro({ guild, user, name, id, nickname, erroNickname, erroRole, tipo = 'registro' }) {
    try {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) return;

        let embed;
        if (tipo === 'reset') {
            embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle('✏️ Reset de ID')
                .setDescription('Um membro resetou seu ID no servidor.')
                .addFields(
                    { name: '👤 Usuário', value: `${user} (\`${user.tag}\`)`, inline: false },
                    { name: '🆔 ID Antigo', value: id || 'N/A', inline: true },
                    { name: '🏷️ Apelido antes do reset', value: nickname || user.username, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `ID: ${user.id} | Reset de ID`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            if (erroNickname) {
                embed.addFields({ name: '⚠️ Erro ao resetar apelido', value: erroNickname, inline: false });
            }
            if (erroRole) {
                embed.addFields({ name: '⚠️ Erro ao remover cargo', value: erroRole, inline: false });
            }
        } else {
            embed = new EmbedBuilder()
                .setColor(erroNickname || erroRole ? 0xffa500 : 0x3498db)
                .setTitle('📝 Nova Liberação de ID')
                .setDescription('Um novo membro realizou a liberação de ID no servidor.')
                .addFields(
                    { name: '👤 Usuário', value: `${user} (\`${user.tag}\`)`, inline: false },
                    { name: '📌 Nome', value: name, inline: true },
                    { name: '🆔 ID', value: id, inline: true },
                    { name: '🏷️ Apelido', value: nickname, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `ID: ${user.id} | Registro`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            if (erroNickname) {
                embed.addFields({ name: '⚠️ Erro ao alterar apelido', value: erroNickname, inline: false });
            }
            if (erroRole) {
                embed.addFields({ name: '⚠️ Erro ao adicionar cargo', value: erroRole, inline: false });
            }
        }

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[ERRO] Falha ao enviar log de registro:', err);
    }
}

client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} pronto!`);

    const commands = [
        {
            name: 'register',
            description: 'Abra o painel de registro para liberar seu ID.'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('🔄 Registrando comandos de barra...');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
});

client.on('guildMemberAdd', async (member) => {
    try {
        if (!member.user.bot) {
            const nickname = `${member.user.username} | ID`;
            if (member.manageable) {
                await member.setNickname(nickname).catch(() => {});
            }
        }
    } catch (e) {
        console.error('[ERRO] Falha ao setar nickname ao entrar:', e);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand() || interaction.isCommand()) {
            if (interaction.commandName === 'register') {
                const embed = new EmbedBuilder()
                    .setColor(0x5e17eb)
                    .setTitle('📑 Liberação de ID - Importante!')
                    .setDescription(
                        [
                            'Olá! Para liberar seu ID, informe seu Nome e Sobrenome (não precisa ser nome real).',
                            '',
                            '⚠️ Use um nome e sobrenome para seu personagem. Não é necessário ser seu nome verdadeiro.',
                            '',
                            'Qualquer dúvida, estamos aqui para ajudar.',
                            '',
                            'Desejamos um ótimo roleplay para todos! 🎮'
                        ].join('\n')
                    )
                    .setImage('');

                const button = new ButtonBuilder()
                    .setCustomId('openRegisterModal')
                    .setLabel('🔗 Liberar meu ID')
                    .setStyle(ButtonStyle.Secondary);

                const changeIdButton = new ButtonBuilder()
                    .setCustomId('resetIdDirect')
                    .setLabel('✏️ Resetar meu ID')
                    .setStyle(ButtonStyle.Danger);

                const actionRow = new ActionRowBuilder().addComponents(button, changeIdButton);

                await interaction.deferReply({ ephemeral: true });
                await interaction.deleteReply().catch(() => {});

                const channel = interaction.channel;
                if (channel) {
                    await channel.send({ embeds: [embed], components: [actionRow] });
                }
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'openRegisterModal') {
                const modal = new ModalBuilder()
                    .setCustomId('registerModal')
                    .setTitle('🔗 Liberação de ID');

                const nameInput = new TextInputBuilder()
                    .setCustomId('nameInput')
                    .setLabel('Nome e Sobrenome')
                    .setPlaceholder('Exemplo: João da Silva')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const idInput = new TextInputBuilder()
                    .setCustomId('idInput')
                    .setLabel('ID do seu personagem')
                    .setPlaceholder('Exemplo: 123')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
                const secondActionRow = new ActionRowBuilder().addComponents(idInput);

                modal.addComponents(firstActionRow, secondActionRow);
                await interaction.showModal(modal);
            }

            if (interaction.customId === 'resetIdDirect') {
                if (!registros[interaction.user.id]) {
                    await interaction.reply({
                        content: '😕 Você ainda não possui um ID registrado para resetar. Use o botão de registro primeiro.',
                        ephemeral: true
                    });
                    return;
                }

                const oldId = registros[interaction.user.id];
                delete registros[interaction.user.id];
                salvarRegistros();

                let erroNickname = null;
                let erroRole = null;
                let member = null;
                try {
                    member = interaction.member;
                    if (!member || !member.guild) {
                        member = await interaction.guild.members.fetch(interaction.user.id);
                    }

                    if (member && member.manageable) {
                        await member.setNickname(null).catch(err => {
                            erroNickname = `Permissão insuficiente ou erro: ${err.message || err}`;
                        });
                    } else {
                        erroNickname = 'O bot não tem permissão para alterar o apelido deste usuário.';
                    }

                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role && member && member.roles.cache.has(roleId)) {
                        await member.roles.remove(role).catch(err => {
                            erroRole = `Permissão insuficiente ou erro: ${err.message || err}`;
                        });
                    }

                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle('✏️ Seu ID foi resetado!')
                        .setDescription(
                            [
                                `Olá! Seu registro de ID foi resetado com sucesso.`,
                                '',
                                `Se desejar, você pode registrar um novo ID a qualquer momento usando o botão de registro.`,
                                '',
                                'Se você não solicitou essa ação, por favor, entre em contato com a equipe.'
                            ].join('\n')
                        )
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setTimestamp();

                    await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
                        console.log(`[LOG] Não foi possível enviar DM para ${interaction.user.tag}`);
                    });

                    await logRegistro({
                        guild: interaction.guild,
                        user: interaction.user,
                        name: interaction.user.username,
                        id: oldId,
                        nickname: member ? (member.nickname || interaction.user.username) : interaction.user.username,
                        erroNickname,
                        erroRole,
                        tipo: 'reset'
                    });

                    let confirmMsg = `✏️ Seu ID foi resetado com sucesso! Agora você pode registrar um novo ID quando quiser.`;
                    if (erroNickname) {
                        confirmMsg += `\n\n⚠️ *Não foi possível resetar seu apelido automaticamente. Por favor, altere manualmente ou peça ajuda à equipe.*`;
                    }
                    if (erroRole) {
                        confirmMsg += `\n\n⚠️ *Não foi possível remover o cargo automaticamente. Avise a equipe para corrigir, se necessário.*`;
                    }

                    await interaction.reply({
                        content: confirmMsg,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('[ERRO] Falha ao resetar ID do usuário:', error);
                    await interaction.reply({
                        content: '😔 Ocorreu um erro ao tentar resetar seu ID. Por favor, tente novamente ou fale com a equipe.',
                        ephemeral: true
                    });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'registerModal') {
                const name = interaction.fields.getTextInputValue('nameInput').trim();
                const id = interaction.fields.getTextInputValue('idInput').trim();

                if (!name || !id) {
                    await interaction.reply({
                        content: '⚠️ Por favor, preencha todos os campos corretamente antes de continuar.',
                        ephemeral: true
                    });
                    return;
                }

                if (registros[interaction.user.id]) {
                    await interaction.reply({
                        content: `😕 Você já possui um ID registrado: **${registros[interaction.user.id]}**. Caso precise resetar, utilize o botão "Resetar meu ID".`,
                        ephemeral: true
                    });
                    return;
                }

                if (Object.values(registros).includes(id)) {
                    await interaction.reply({
                        content: '😕 Esse ID já está em uso por outro membro. Tente um ID diferente ou fale com a equipe se precisar de ajuda.',
                        ephemeral: true
                    });
                    return;
                }

                registros[interaction.user.id] = id;
                salvarRegistros();

                const nickname = `${name} | ${id}`;

                let erroNickname = null;
                let erroRole = null;

                try {
                    let member = interaction.member;
                    if (!member || !member.guild) {
                        member = await interaction.guild.members.fetch(interaction.user.id);
                    }

                    if (member && member.manageable) {
                        await member.setNickname(nickname).catch(err => {
                            erroNickname = `Permissão insuficiente ou erro: ${err.message || err}`;
                        });
                    } else {
                        erroNickname = 'O bot não tem permissão para alterar o apelido deste usuário.';
                    }

                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role && member && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role).catch(err => {
                            erroRole = `Permissão insuficiente ou erro: ${err.message || err}`;
                        });
                    } else if (!role) {
                        erroRole = 'Cargo de registro não encontrado.';
                    }

                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ ID liberado com sucesso!')
                        .setDescription(
                            [
                                `Olá, **${name}**!`,
                                '',
                                'Sua liberação de ID foi realizada com sucesso.',
                                '',
                                `👤 **Nome:** ${name}`,
                                `🆔 **ID:** ${id}`,
                                '',
                                'Se você informou algum dado incorreto, seu nome poderá ser ajustado por um administrador.',
                                '',
                                'Qualquer dúvida, estamos à disposição. Aproveite o servidor e bom roleplay!'
                            ].join('\n')
                        )
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setTimestamp();

                    await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
                        console.log(`[LOG] Não foi possível enviar DM para ${interaction.user.tag}`);
                    });

                    await logRegistro({
                        guild: interaction.guild,
                        user: interaction.user,
                        name,
                        id,
                        nickname,
                        erroNickname,
                        erroRole,
                        tipo: 'registro'
                    });

                    let confirmMsg = `✅ Prontinho, ${name}! Seu ID foi liberado e agora seu apelido é **${nickname}**. Seja bem-vindo(a) e bom roleplay!`;
                    if (erroNickname) {
                        confirmMsg += `\n\n⚠️ *Não foi possível alterar seu apelido automaticamente. Por favor, altere manualmente ou peça ajuda à equipe.*`;
                    }
                    if (erroRole) {
                        confirmMsg += `\n\n⚠️ *Não foi possível adicionar o cargo automaticamente. Avise a equipe para corrigir.*`;
                    }

                    await interaction.reply({
                        content: confirmMsg,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('[ERRO] Falha no registro do usuário:', error);
                    await interaction.reply({
                        content: '😔 Ocorreu um erro ao tentar liberar seu ID. Por favor, tente novamente ou fale com a equipe.',
                        ephemeral: true
                    });
                }
            }
        }
    } catch (err) {
        console.error('[ERRO] Evento interactionCreate:', err);
        if (interaction && !interaction.replied) {
            await interaction.reply({
                content: '😬 Opa! Algo inesperado aconteceu. Tente novamente ou avise a equipe.',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

client.login(token);
